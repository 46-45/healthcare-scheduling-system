import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Customer } from '../../customers/entities/customer.entity';
import { Doctor } from '../../doctors/entities/doctor.entity';
import { Schedule } from '../../schedules/entities/schedule.entity';

/**
 * Pagination metadata for paginated list queries.
 * Provides information about the current page, total pages, and navigation capabilities.
 */
@ObjectType({ description: 'Pagination information for list queries' })
export class PaginationInfo {
  @Field(() => Int, { description: 'Current page number (1-indexed)' })
  currentPage: number;

  @Field(() => Int, { description: 'Total number of pages available' })
  totalPages: number;

  @Field(() => Int, { description: 'Total count of items across all pages' })
  totalCount: number;

  @Field({ description: 'Indicates whether there is a next page available' })
  hasNextPage: boolean;

  @Field({ description: 'Indicates whether there is a previous page available' })
  hasPreviousPage: boolean;
}

/**
 * Paginated response for customer list queries.
 * Contains the list of customers and pagination metadata.
 */
@ObjectType({ description: 'Paginated list of customers' })
export class CustomerConnection {
  @Field(() => [Customer], { description: 'Array of customer records for the current page' })
  data: Customer[];

  @Field(() => PaginationInfo, { description: 'Pagination metadata' })
  pagination: PaginationInfo;
}

/**
 * Paginated response for doctor list queries.
 * Contains the list of doctors and pagination metadata.
 */
@ObjectType({ description: 'Paginated list of doctors' })
export class DoctorConnection {
  @Field(() => [Doctor], { description: 'Array of doctor records for the current page' })
  data: Doctor[];

  @Field(() => PaginationInfo, { description: 'Pagination metadata' })
  pagination: PaginationInfo;
}

/**
 * Paginated response for schedule list queries.
 * Contains the list of schedules and pagination metadata.
 */
@ObjectType({ description: 'Paginated list of schedules' })
export class ScheduleConnection {
  @Field(() => [Schedule], { description: 'Array of schedule records for the current page' })
  data: Schedule[];

  @Field(() => PaginationInfo, { description: 'Pagination metadata' })
  pagination: PaginationInfo;
}
