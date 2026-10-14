import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Input data transfer object for creating a new doctor.
 * Validates doctor name field.
 */
@InputType({ description: 'Input for creating a new doctor record' })
export class CreateDoctorInput {
  @Field({ 
    description: 'Full name of the doctor. Example: Dr. Jane Smith',
    nullable: false
  })
  @IsNotEmpty({ message: 'Doctor name is required' })
  @IsString({ message: 'Doctor name must be a string' })
  name: string;
}
