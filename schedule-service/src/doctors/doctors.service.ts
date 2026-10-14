import { Injectable, Logger } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CreateDoctorInput } from './dto/create-doctor.input';
import { UpdateDoctorInput } from './dto/update-doctor.input';
import { Doctor } from './entities/doctor.entity';
import { DoctorConnection } from '../common/entities/pagination.entity';
import { Prisma } from '@prisma/client';

/**
 * DoctorService handles all CRUD operations for doctor records.
 * Implements pagination, caching, error mapping, and database interactions.
 * 
 * */
@Injectable()
export class DoctorsService {
  private readonly logger = new Logger(DoctorsService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Create a new doctor record.
   * Invalidates cache after successful creation.
   * @param data Doctor creation input containing name
   * @returns Created doctor entity
   * @throws GraphQLError with code CONFLICT if creation fails
   * 
   *   */
  async create(data: CreateDoctorInput): Promise<Doctor> {
    try {
      const doctor = await this.prisma.doctor.create({
        data,
      });
      
      // Invalidate doctors list cache after successful creation
      await this.cacheService.invalidatePattern('doctors:*');
      
      this.logger.log(`Doctor created successfully: ${doctor.id}`);
      return doctor;
    } catch (error) {
      this.logger.error(`Failed to create doctor: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieve paginated list of all doctors.
   * Checks cache before querying database (cache-aside pattern).
   * @param page Page number (default: 1, minimum: 1)
   * @param limit Results per page (default: 10, minimum: 1, maximum: 100)
   * @returns Paginated doctor connection with metadata
   * 
   *   */
  async findAll(page: number = 1, limit: number = 10): Promise<DoctorConnection> {
    // Validate and sanitize pagination parameters
    const validPage = Math.max(1, page);
    const validLimit = Math.min(100, Math.max(1, limit));
    const skip = (validPage - 1) * validLimit;

    // Check cache first
    const cacheKey = `doctors:list:page:${validPage}:limit:${validLimit}`;
    const cached = await this.cacheService.get<DoctorConnection>(cacheKey);
    
    if (cached) {
      this.logger.log(`Cache hit for key: ${cacheKey}`);
      return cached;
    }

    try {
      // Execute parallel queries for data and count
      const [data, totalCount] = await Promise.all([
        this.prisma.doctor.findMany({
          skip,
          take: validLimit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.doctor.count(),
      ]);

      const totalPages = Math.ceil(totalCount / validLimit);

      const result: DoctorConnection = {
        data,
        pagination: {
          currentPage: validPage,
          totalPages,
          totalCount,
          hasNextPage: validPage < totalPages,
          hasPreviousPage: validPage > 1,
        },
      };

      // Cache the result
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
      this.logger.log(`Cache set for key: ${cacheKey}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch doctors: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieve a single doctor by ID.
   * @param id Doctor UUID
   * @returns Doctor entity
   * @throws GraphQLError with code NOT_FOUND if doctor doesn't exist
   * 
   *   */
  async findOne(id: string): Promise<Doctor> {
    try {
      const doctor = await this.prisma.doctor.findUnique({
        where: { id },
      });

      if (!doctor) {
        throw new GraphQLError('Doctor not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return doctor;
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error;
      }
      this.logger.error(`Failed to fetch doctor ${id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update an existing doctor record.
   * Invalidates cache after successful update.
   * @param id Doctor UUID
   * @param data Update input containing fields to modify
   * @returns Updated doctor entity
   * @throws GraphQLError with code NOT_FOUND if doctor doesn't exist (P2025)
   * 
   *   */
  async update(id: string, data: UpdateDoctorInput): Promise<Doctor> {
    try {
      const doctor = await this.prisma.doctor.update({
        where: { id },
        data,
      });

      // Invalidate doctors list cache after successful update
      await this.cacheService.invalidatePattern('doctors:*');

      this.logger.log(`Doctor updated successfully: ${id}`);
      return doctor;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2025: Record not found
        if (error.code === 'P2025') {
          throw new GraphQLError('Doctor not found', {
            extensions: { code: 'NOT_FOUND' },
          });
        }
      }

      this.logger.error(`Failed to update doctor ${id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a doctor record.
   * Enforces referential integrity - cannot delete doctor with existing schedules.
   * Invalidates cache after successful deletion.
   * @param id Doctor UUID
   * @returns true if deletion successful
   * @throws GraphQLError with code CONSTRAINT_VIOLATION if doctor has schedules (P2003)
   * @throws GraphQLError with code NOT_FOUND if doctor doesn't exist (P2025)
   * 
   *   */
  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.doctor.delete({
        where: { id },
      });

      // Invalidate doctors list cache after successful deletion
      await this.cacheService.invalidatePattern('doctors:*');

      this.logger.log(`Doctor deleted successfully: ${id}`);
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2003: Foreign key constraint violation
        if (error.code === 'P2003') {
          throw new GraphQLError('Cannot delete doctor with existing schedules', {
            extensions: { code: 'CONSTRAINT_VIOLATION' },
          });
        }

        // P2025: Record not found
        if (error.code === 'P2025') {
          throw new GraphQLError('Doctor not found', {
            extensions: { code: 'NOT_FOUND' },
          });
        }
      }

      this.logger.error(`Failed to delete doctor ${id}: ${error.message}`);
      throw error;
    }
  }
}
