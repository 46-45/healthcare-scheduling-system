import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { SchedulesService } from './schedules.service';
import { Schedule } from './entities/schedule.entity';
import { ScheduleConnection } from '../common/entities/pagination.entity';
import { CreateScheduleInput } from './dto/create-schedule.input';
import { ScheduleFiltersInput } from './dto/schedule-filters.input';

/**
 * ScheduleResolver handles GraphQL queries and mutations for schedule management.
 * 
 * All operations require authentication via AuthGuard (applied globally).
 * 
 * */
@Resolver(() => Schedule)
export class SchedulesResolver {
  constructor(private readonly schedulesService: SchedulesService) {}

  /**
   * Create a new schedule with validation and conflict detection.
   * 
   * Validates:
   * - Customer and doctor existence
   * - scheduledAt format (ISO 8601 with timezone)
   * - Calendar date validity (prevents dates like 2026-02-30)
   * - Schedule conflicts (doctor availability at requested time)
   * 
   * After successful creation, enqueues email notification job.
   * 
   * @param createScheduleInput Schedule creation data
   * @returns Created schedule with customer and doctor relations
   * 
   *   */
  @Mutation(() => Schedule, {
    description: 'Create a new consultation schedule between a customer and doctor',
  })
  async createSchedule(
    @Args('createScheduleInput') createScheduleInput: CreateScheduleInput,
  ): Promise<Schedule> {
    return this.schedulesService.create(createScheduleInput);
  }

  /**
   * Query all schedules with filtering and pagination.
   * 
   * Supports filtering by:
   * - customerId: Filter by specific customer
   * - doctorId: Filter by specific doctor
   * - scheduledAtFrom and scheduledAtTo: Date range filtering (validates From <= To)
   * 
   * Returns schedules with customer and doctor relations.
   * 
   * @param filters Pagination and filter parameters
   * @returns Paginated list of schedules
   * 
   *   */
  @Query(() => ScheduleConnection, {
    description: 'List all schedules with optional filtering by customer, doctor, or date range',
  })
  async schedules(
    @Args('filters', { nullable: true }) filters?: ScheduleFiltersInput,
  ): Promise<ScheduleConnection> {
    return this.schedulesService.findAll(filters || {});
  }

  /**
   * Get a single schedule by ID.
   * 
   * Returns schedule with customer and doctor relations.
   * 
   * @param id Schedule ID (UUID)
   * @returns Schedule entity
   * 
   *   */
  @Query(() => Schedule, {
    description: 'Get a specific schedule by ID',
  })
  async schedule(@Args('id') id: string): Promise<Schedule> {
    return this.schedulesService.findOne(id);
  }

  /**
   * Delete a schedule by ID.
   * 
   * After successful deletion, enqueues cancellation email notification job.
   * 
   * @param id Schedule ID to delete
   * @returns true if deletion was successful
   * 
   *   */
  @Mutation(() => Boolean, {
    description: 'Delete a schedule by ID and send cancellation email notification',
  })
  async deleteSchedule(@Args('id') id: string): Promise<boolean> {
    return this.schedulesService.delete(id);
  }
}
