import { Injectable } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CreateCustomerInput } from './dto/create-customer.input';
import { UpdateCustomerInput } from './dto/update-customer.input';
import { Customer } from './entities/customer.entity';
import { CustomerConnection } from '../common/entities/pagination.entity';
import { Prisma } from '@prisma/client';

/**
 * Service responsible for managing customer CRUD operations.
 * Implements business logic for customer creation, retrieval, update, and deletion
 * with proper error handling and Prisma error code mapping.
 * 
 * */
@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Create a new customer with the provided data.
   * Invalidates customers list cache after successful creation.
   * 
   * @param createCustomerInput - Customer data (name and email)
   * @returns The created customer record
   * @throws GraphQLError with code CONFLICT if email already exists (Prisma P2002)
   * 
   *   */
  async create(createCustomerInput: CreateCustomerInput): Promise<Customer> {
    try {
      const customer = await this.prisma.customer.create({
        data: {
          name: createCustomerInput.name,
          email: createCustomerInput.email,
        },
      });

      // Invalidate customers list cache
      await this.cacheService.invalidatePattern('customers:*');

      return customer;
    } catch (error) {
      // Handle Prisma unique constraint violation (duplicate email)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new GraphQLError('Email already exists', {
          extensions: { code: 'CONFLICT' },
        });
      }
      throw error;
    }
  }

  /**
   * Retrieve a paginated list of all customers.
   * Checks cache before querying database, caches results for 5 minutes.
   * 
   * @param page - Page number (default: 1, minimum: 1)
   * @param limit - Items per page (default: 10, minimum: 1, maximum: 100)
   * @returns CustomerConnection with paginated data and metadata
   * 
   *   */
  async findAll(page: number = 1, limit: number = 10): Promise<CustomerConnection> {
    // Ensure page and limit are within valid ranges
    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(100, limit));
    
    // Check cache first
    const cacheKey = `customers:list:page:${validPage}:limit:${validLimit}`;
    const cached = await this.cacheService.get<CustomerConnection>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    // Calculate pagination offset
    const skip = (validPage - 1) * validLimit;

    // Execute parallel queries for data and total count
    const [data, totalCount] = await Promise.all([
      this.prisma.customer.findMany({
        skip,
        take: validLimit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count(),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / validLimit);
    const hasNextPage = validPage * validLimit < totalCount;
    const hasPreviousPage = validPage > 1;

    const result: CustomerConnection = {
      data,
      pagination: {
        currentPage: validPage,
        totalPages,
        totalCount,
        hasNextPage,
        hasPreviousPage,
      },
    };

    // Cache result with TTL of 5 minutes (300 seconds)
    await this.cacheService.set(cacheKey, result, 300);

    return result;
  }

  /**
   * Retrieve a single customer by ID.
   * 
   * @param id - Customer UUID
   * @returns The customer record
   * @throws GraphQLError with code NOT_FOUND if customer does not exist
   * 
   *   */
  async findOne(id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new GraphQLError('Customer not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    return customer;
  }

  /**
   * Update an existing customer record.
   * Invalidates customers list cache after successful update.
   * 
   * @param updateCustomerInput - Update data (id required, name and email optional)
   * @returns The updated customer record
   * @throws GraphQLError with code CONFLICT if new email already exists (Prisma P2002)
   * @throws GraphQLError with code NOT_FOUND if customer does not exist (Prisma P2025)
   * 
   *   */
  async update(updateCustomerInput: UpdateCustomerInput): Promise<Customer> {
    try {
      const { id, ...updateData } = updateCustomerInput;

      const customer = await this.prisma.customer.update({
        where: { id },
        data: updateData,
      });

      // Invalidate customers list cache
      await this.cacheService.invalidatePattern('customers:*');

      return customer;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Handle unique constraint violation (duplicate email)
        if (error.code === 'P2002') {
          throw new GraphQLError('Email already exists', {
            extensions: { code: 'CONFLICT' },
          });
        }

        // Handle record not found
        if (error.code === 'P2025') {
          throw new GraphQLError('Customer not found', {
            extensions: { code: 'NOT_FOUND' },
          });
        }
      }
      throw error;
    }
  }

  /**
   * Delete a customer by ID.
   * Invalidates customers list cache after successful deletion.
   * 
   * @param id - Customer UUID
   * @returns true if deletion was successful
   * @throws GraphQLError with code CONSTRAINT_VIOLATION if customer has existing schedules (Prisma P2003)
   * @throws GraphQLError with code NOT_FOUND if customer does not exist (Prisma P2025)
   * 
   *   */
  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.customer.delete({
        where: { id },
      });

      // Invalidate customers list cache
      await this.cacheService.invalidatePattern('customers:*');

      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Handle foreign key constraint violation (customer has existing schedules)
        if (error.code === 'P2003') {
          throw new GraphQLError('Cannot delete customer with existing schedules', {
            extensions: { code: 'CONSTRAINT_VIOLATION' },
          });
        }

        // Handle record not found
        if (error.code === 'P2025') {
          throw new GraphQLError('Customer not found', {
            extensions: { code: 'NOT_FOUND' },
          });
        }
      }
      throw error;
    }
  }
}
