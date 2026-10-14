import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * Input data transfer object for creating a new customer.
 * Validates name and email fields with proper format checking.
 */
@InputType({ description: 'Input for creating a new customer record' })
export class CreateCustomerInput {
  @Field({ 
    description: 'Full name of the customer',
    nullable: false
  })
  @IsNotEmpty({ message: 'Customer name is required' })
  @IsString({ message: 'Customer name must be a string' })
  name: string;

  @Field({ 
    description: 'Email address of the customer (must be unique). Example: customer@example.com',
    nullable: false
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Customer email is required' })
  email: string;
}
