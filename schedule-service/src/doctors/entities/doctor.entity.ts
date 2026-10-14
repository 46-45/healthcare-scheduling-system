import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * Doctor entity representing a medical professional who provides consultations.
 * Doctors can have multiple consultation schedules with different customers.
 */
@ObjectType({ description: 'A doctor (medical professional) in the healthcare system' })
export class Doctor {
  @Field(() => ID, { description: 'Unique identifier for the doctor (UUID)' })
  id: string;

  @Field({ description: 'Full name of the doctor' })
  name: string;

  @Field({ description: 'Timestamp when the doctor record was created' })
  createdAt: Date;

  @Field({ description: 'Timestamp when the doctor record was last updated' })
  updatedAt: Date;
}
