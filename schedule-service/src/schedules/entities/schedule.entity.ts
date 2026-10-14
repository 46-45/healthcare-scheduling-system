import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Customer } from '../../customers/entities/customer.entity';
import { Doctor } from '../../doctors/entities/doctor.entity';

/**
 * Schedule entity representing a consultation appointment between a customer and a doctor.
 * Each schedule has a unique time slot per doctor to prevent conflicts.
 */
@ObjectType({ description: 'A consultation schedule/appointment in the healthcare system' })
export class Schedule {
  @Field(() => ID, { description: 'Unique identifier for the schedule (UUID)' })
  id: string;

  @Field({ description: 'Purpose or reason for the consultation' })
  objective: string;

  @Field({ description: 'Scheduled date and time for the consultation (ISO 8601 UTC format)' })
  scheduledAt: Date;

  @Field(() => Customer, { description: 'Customer (patient) associated with this schedule' })
  customer: Customer;

  @Field(() => Doctor, { description: 'Doctor providing the consultation' })
  doctor: Doctor;

  @Field({ description: 'Timestamp when the schedule was created' })
  createdAt: Date;

  @Field({ description: 'Timestamp when the schedule was last updated' })
  updatedAt: Date;
}
