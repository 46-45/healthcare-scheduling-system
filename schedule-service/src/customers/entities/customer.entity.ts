import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * Customer entity representing a patient who books consultation appointments.
 * Customers can create multiple schedules with different doctors.
 */
@ObjectType({ description: 'A customer (patient) in the healthcare system' })
export class Customer {
  @Field(() => ID, { description: 'Unique identifier for the customer (UUID)' })
  id: string;

  @Field({ description: 'Full name of the customer' })
  name: string;

  @Field({ description: 'Email address of the customer (unique)' })
  email: string;

  @Field({ description: 'Timestamp when the customer record was created' })
  createdAt: Date;

  @Field({ description: 'Timestamp when the customer record was last updated' })
  updatedAt: Date;
}
