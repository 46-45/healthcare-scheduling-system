import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { GraphQLError } from 'graphql';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleInput } from './dto/create-schedule.input';
import { ScheduleFiltersInput } from './dto/schedule-filters.input';
import { Schedule } from './entities/schedule.entity';
import { ScheduleConnection } from '../common/entities/pagination.entity';
import { Prisma } from '@prisma/client';
import { EmailJobData } from '../notification/notification.processor';

/**
 * ScheduleService handles all CRUD operations for schedule records.
 * Implements schedule creation with validation, conflict detection, and error mapping.
 * 
 * */
@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notification') private readonly notificationQueue: Queue<EmailJobData>,
  ) {}

  /**
   * Create a new schedule with comprehensive validation.
   * 
   * Validation steps:
   * 1. Validate customer exists
   * 2. Validate doctor exists
   * 3. Validate scheduledAt format (ISO 8601 with timezone)
   * 4. Parse and validate date (prevent invalid dates like 2026-02-30)
   * 5. Perform round-trip verification to detect date overflow
   * 6. Convert to UTC for storage
   * 7. Create schedule with conflict detection via unique constraint
   * 
   * @param data Schedule creation input (customerId, doctorId, scheduledAt, objective)
   * @returns Created schedule entity with customer and doctor relations
   * @throws GraphQLError NOT_FOUND if customer or doctor doesn't exist
   * @throws GraphQLError INVALID_INPUT if scheduledAt format or date is invalid
   * @throws GraphQLError CONFLICT if doctor has another schedule at the same time (P2002)
   * 
   *   */
  async create(data: CreateScheduleInput): Promise<Schedule> {
    // Step 1 & 2: Validate foreign keys (customer and doctor existence)
    const [customer, doctor] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: data.customerId } }),
      this.prisma.doctor.findUnique({ where: { id: data.doctorId } }),
    ]);

    if (!customer) {
      throw new GraphQLError('Customer not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    if (!doctor) {
      throw new GraphQLError('Doctor not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Step 3: Validate scheduledAt format with regex
    // The regex pattern ensures ISO 8601 format with timezone offset
    // Examples: "2026-10-15T14:00:00+07:00" or "2026-10-15T14:00:00Z"
    const iso8601WithTimezoneRegex = 
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/;

    if (!iso8601WithTimezoneRegex.test(data.scheduledAt)) {
      throw new GraphQLError(
        'scheduledAt must be in ISO 8601 format with timezone offset',
        { extensions: { code: 'INVALID_INPUT' } }
      );
    }

    // Step 4: Parse the date and check if it's valid
    const parsed = new Date(data.scheduledAt);
    if (isNaN(parsed.getTime())) {
      throw new GraphQLError('scheduledAt contains an invalid date', {
        extensions: { code: 'INVALID_INPUT' },
      });
    }

    // Step 5: Round-trip verification to detect invalid dates
    // JavaScript's Date constructor silently overflows invalid dates
    // For example: new Date('2026-02-30T10:00:00Z') becomes 2026-03-02
    // This verification prevents such invalid dates from being accepted
    const inputDate = data.scheduledAt.substring(0, 10); // Extract "YYYY-MM-DD"
    const [year, month, day] = inputDate.split('-').map(Number);
    
    // Compare parsed date's UTC components with original input
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() + 1 !== month || // getUTCMonth() is 0-indexed
      parsed.getUTCDate() !== day
    ) {
      throw new GraphQLError('scheduledAt contains an invalid date', {
        extensions: { code: 'INVALID_INPUT' },
      });
    }

    // Step 6: Convert validated date to UTC ISO string for storage
    const scheduledAtUTC = parsed.toISOString();

    // Step 7: Create schedule with conflict detection
    try {
      const schedule = await this.prisma.schedule.create({
        data: {
          customerId: data.customerId,
          doctorId: data.doctorId,
          scheduledAt: scheduledAtUTC,
          objective: data.objective,
        },
        include: {
          customer: true,
          doctor: true,
        },
      });

      this.logger.log(`Schedule created successfully: ${schedule.id}`);
      
      // [P2] Enqueue email notification job after successful creation
      try {
        await this.notificationQueue.add('send-email', {
          type: 'schedule_created',
          customerEmail: customer.email,
          customerName: customer.name,
          doctorName: doctor.name,
          scheduledAt: scheduledAtUTC,
          objective: data.objective,
        });
        
        this.logger.log(`Email notification job enqueued for schedule ${schedule.id}`);
      } catch (queueError) {
        // Log error but don't fail the schedule creation
        // The schedule has already been created successfully
        this.logger.error(
          `Failed to enqueue email notification for schedule ${schedule.id}:`,
          queueError,
        );
      }
      
      return schedule;
    } catch (error) {
      // Handle Prisma unique constraint violation (schedule conflict)
      // The unique constraint on [doctorId, scheduledAt] prevents race conditions
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Check if the violation is on the doctorId_scheduledAt constraint
        const target = error.meta?.target as string[] | undefined;
        if (target?.includes('doctorId')) {
          throw new GraphQLError('Doctor is not available at the requested time', {
            extensions: { code: 'CONFLICT' },
          });
        }
      }

      this.logger.error(`Failed to create schedule: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find all schedules with filtering and pagination.
   * 
   * Supports filtering by:
   * - customerId: Filter schedules by specific customer
   * - doctorId: Filter schedules by specific doctor
   * - scheduledAtFrom: Filter schedules starting from this date/time (inclusive)
   * - scheduledAtTo: Filter schedules up to this date/time (inclusive)
   * 
   * Validation:
   * - If both scheduledAtFrom and scheduledAtTo are provided, validates From <= To
   * 
   * Date handling:
   * - Converts filter dates (with timezone) to UTC ISO strings before querying
   * - Returns scheduledAt in ISO 8601 UTC format
   * 
   * @param filters Pagination and filter parameters
   * @returns Paginated list of schedules with customer and doctor relations
   * @throws GraphQLError INVALID_INPUT if date range is invalid (From > To)
   * 
   *   */
  async findAll(filters: ScheduleFiltersInput): Promise<ScheduleConnection> {
    const { 
      page = 1, 
      limit = 10, 
      customerId, 
      doctorId, 
      scheduledAtFrom, 
      scheduledAtTo 
    } = filters;

    // Validate date range: if both From and To provided, check From <= To
    if (scheduledAtFrom && scheduledAtTo) {
      const fromDate = new Date(scheduledAtFrom);
      const toDate = new Date(scheduledAtTo);
      
      if (fromDate > toDate) {
        throw new GraphQLError(
          'scheduledAtFrom cannot be greater than scheduledAtTo',
          { extensions: { code: 'INVALID_INPUT' } }
        );
      }
    }

    // Build where clause dynamically based on provided filters
    const where: Prisma.ScheduleWhereInput = {};
    
    if (customerId) {
      where.customerId = customerId;
    }
    
    if (doctorId) {
      where.doctorId = doctorId;
    }
    
    // Convert filter dates to UTC ISO strings before querying
    if (scheduledAtFrom || scheduledAtTo) {
      where.scheduledAt = {};
      
      if (scheduledAtFrom) {
        where.scheduledAt.gte = new Date(scheduledAtFrom).toISOString();
      }
      
      if (scheduledAtTo) {
        where.scheduledAt.lte = new Date(scheduledAtTo).toISOString();
      }
    }

    // Calculate pagination offset
    const skip = (page - 1) * limit;

    // Query database with filters, pagination, and relations
    const [data, totalCount] = await Promise.all([
      this.prisma.schedule.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: true,
          doctor: true,
        },
        orderBy: {
          scheduledAt: 'asc', // Order by scheduled time ascending
        },
      }),
      this.prisma.schedule.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);

    return {
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page * limit < totalCount,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Find a single schedule by ID.
   * 
   * Includes customer and doctor relations to prevent N+1 queries.
   * Returns scheduledAt in ISO 8601 UTC format.
   * 
   * @param id Schedule ID (UUID)
   * @returns Schedule entity with customer and doctor relations
   * @throws GraphQLError NOT_FOUND if schedule doesn't exist
   * 
   *   */
  async findOne(id: string): Promise<Schedule> {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      include: {
        customer: true,
        doctor: true,
      },
    });

    if (!schedule) {
      throw new GraphQLError('Schedule not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    return schedule;
  }

  /**
   * Delete a schedule by ID.
   * 
   * This method:
   * 1. Validates that the schedule exists
   * 2. Retrieves complete schedule data including customer and doctor relations
   * 3. Deletes the schedule record
   * 4. Returns true after successful deletion
   * 
   * The schedule data (customer email, customer name, doctor name, scheduledAt, objective)
   * is retrieved before deletion to support email notifications in P2.
   * 
   * @param id Schedule ID to delete
   * @returns true if deletion was successful
   * @throws GraphQLError NOT_FOUND if schedule doesn't exist
   * 
   *   */
  async delete(id: string): Promise<boolean> {
    // Step 1 & 2: Find schedule by ID and retrieve complete data with relations
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      include: {
        customer: true,
        doctor: true,
      },
    });

    // Validate schedule exists
    if (!schedule) {
      throw new GraphQLError('Schedule not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Store complete schedule data for potential email notification (P2)
    // This includes: customer.email, customer.name, doctor.name, scheduledAt, objective
    this.logger.log(`Deleting schedule ${id} for customer ${schedule.customer.email}`);

    // Step 3: Delete the schedule record
    await this.prisma.schedule.delete({
      where: { id },
    });

    this.logger.log(`Schedule ${id} deleted successfully`);

    // [P2] Enqueue cancellation email notification job after successful deletion
    try {
      await this.notificationQueue.add('send-email', {
        type: 'schedule_cancelled',
        customerEmail: schedule.customer.email,
        customerName: schedule.customer.name,
        doctorName: schedule.doctor.name,
        scheduledAt: schedule.scheduledAt.toISOString(),
        objective: schedule.objective,
      });
      
      this.logger.log(`Cancellation email notification job enqueued for deleted schedule ${id}`);
    } catch (queueError) {
      // Log error but don't fail the deletion
      // The schedule has already been deleted successfully
      this.logger.error(
        `Failed to enqueue cancellation email for schedule ${id}:`,
        queueError,
      );
    }

    // Step 4: Return true after successful deletion
    return true;
  }
}
