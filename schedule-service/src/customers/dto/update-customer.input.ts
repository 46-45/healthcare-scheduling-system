import { InputType, Field, ID } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Input data transfer object for updating an existing customer.
 * All fields except ID are optional to allow partial updates.
 */
@InputType({ description: 'Input for updating an existing customer record' })
export class UpdateCustomerInput {
  @Field(() => ID, { 
    description: 'Unique identifier of the customer to update',
    nullable: false
  })
  @IsNotEmpty({ message: 'Customer ID is required' })
  @IsUUID('4', { message: 'Customer ID must be a valid UUID' })
  id: string;

  @Field({ 
    description: 'Full name of the customer (optional for update). Example: John Doe',
    nullable: true
  })
  @IsOptional()
  @IsString({ message: 'Customer name must be a string' })
  name?: string;

  @Field({ 
    description: 'Email address of the customer (optional for update, must be unique if provided). Example: newemail@example.com',
    nullable: true
  })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;
}
