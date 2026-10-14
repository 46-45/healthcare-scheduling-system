import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty } from 'class-validator';

/**
 * Input data transfer object for user login.
 * Accepts email and password credentials.
 */
@InputType({ description: 'Input for user authentication' })
export class LoginInput {
  @Field({ description: 'Email address of the user' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @Field({ description: 'Password for authentication' })
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
