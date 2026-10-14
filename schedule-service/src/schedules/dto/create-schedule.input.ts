import { InputType, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsUUID, Matches } from 'class-validator';

/**
 * Input data transfer object for creating a new schedule.
 * Validates customer ID, doctor ID, scheduled time, and consultation objective.
 */
@InputType({ description: 'Input for creating a new consultation schedule' })
export class CreateScheduleInput {
  @Field(() => ID, { 
    description: 'Unique identifier of the customer booking the appointment',
    nullable: false
  })
  @IsNotEmpty({ message: 'Customer ID is required' })
  @IsUUID('4', { message: 'Customer ID must be a valid UUID' })
  customerId: string;

  @Field(() => ID, { 
    description: 'Unique identifier of the doctor for the appointment',
    nullable: false
  })
  @IsNotEmpty({ message: 'Doctor ID is required' })
  @IsUUID('4', { message: 'Doctor ID must be a valid UUID' })
  doctorId: string;

  @Field({ 
    description: 'Scheduled date and time in ISO 8601 format with timezone offset. Example: "2026-10-15T14:00:00+07:00" or "2026-10-15T14:00:00Z"',
    nullable: false
  })
  @IsNotEmpty({ message: 'Scheduled time is required' })
  @IsString({ message: 'Scheduled time must be a string' })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/, {
    message: 'scheduledAt must be in ISO 8601 format with timezone offset (e.g., "2026-10-15T14:00:00+07:00" or "2026-10-15T14:00:00Z")'
  })
  scheduledAt: string;

  @Field({ 
    description: 'Purpose or objective of the consultation. Example: "Annual checkup" or "Follow-up consultation"',
    nullable: false
  })
  @IsNotEmpty({ message: 'Consultation objective is required' })
  @IsString({ message: 'Objective must be a string' })
  objective: string;
}
