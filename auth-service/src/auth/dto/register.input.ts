import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, Matches, MinLength } from 'class-validator';

/**
 * Input data transfer object for user registration.
 * Validates email format and password strength requirements.
 */
@InputType({ description: 'Input for registering a new user account' })
export class RegisterInput {
  @Field({ description: 'Email address for the new account (must be unique)' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @Field({ description: 'Password for the new account (minimum 8 characters, must contain at least one letter and one number)' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, {
    message: 'Password must be at least 8 characters and contain at least one letter and one number',
  })
  password: string;
}
