import { InputType, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Input data transfer object for updating an existing doctor.
 * Name field is optional to allow partial updates.
 */
@InputType({ description: 'Input for updating an existing doctor record' })
export class UpdateDoctorInput {
  @Field(() => ID, { 
    description: 'Unique identifier of the doctor to update',
    nullable: false
  })
  @IsNotEmpty({ message: 'Doctor ID is required' })
  @IsUUID('4', { message: 'Doctor ID must be a valid UUID' })
  id: string;

  @Field({ 
    description: 'Full name of the doctor (optional for update). Example: Dr. Jane Smith',
    nullable: true
  })
  @IsOptional()
  @IsString({ message: 'Doctor name must be a string' })
  name?: string;
}
