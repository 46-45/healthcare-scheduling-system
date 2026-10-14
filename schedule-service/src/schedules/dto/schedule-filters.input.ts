import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, IsUUID, Min, Max } from 'class-validator';

/**
 * Input data transfer object for filtering and paginating schedule queries.
 * Supports filtering by customer, doctor, date range, and pagination parameters.
 */
@InputType({ description: 'Input for filtering and paginating schedule queries' })
export class ScheduleFiltersInput {
  @Field(() => Int, { 
    description: 'Page number for pagination (minimum: 1). Example: 1',
    nullable: true,
    defaultValue: 1
  })
  @IsOptional()
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @Field(() => Int, { 
    description: 'Number of items per page (minimum: 1, maximum: 100). Example: 10',
    nullable: true,
    defaultValue: 10
  })
  @IsOptional()
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit?: number = 10;

  @Field(() => ID, { 
    description: 'Filter schedules by customer ID (optional). Example: "550e8400-e29b-41d4-a716-446655440000"',
    nullable: true
  })
  @IsOptional()
  @IsUUID('4', { message: 'Customer ID must be a valid UUID' })
  customerId?: string;

  @Field(() => ID, { 
    description: 'Filter schedules by doctor ID (optional). Example: "550e8400-e29b-41d4-a716-446655440001"',
    nullable: true
  })
  @IsOptional()
  @IsUUID('4', { message: 'Doctor ID must be a valid UUID' })
  doctorId?: string;

  @Field({ 
    description: 'Filter schedules starting from this date/time in ISO 8601 format with timezone (optional). Example: "2026-10-01T00:00:00+07:00"',
    nullable: true
  })
  @IsOptional()
  @IsString({ message: 'scheduledAtFrom must be a string' })
  scheduledAtFrom?: string;

  @Field({ 
    description: 'Filter schedules up to this date/time in ISO 8601 format with timezone (optional). Example: "2026-10-31T23:59:59+07:00"',
    nullable: true
  })
  @IsOptional()
  @IsString({ message: 'scheduledAtTo must be a string' })
  scheduledAtTo?: string;
}
