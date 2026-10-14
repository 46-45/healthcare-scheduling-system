import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { DoctorsService } from './doctors.service';
import { Doctor } from './entities/doctor.entity';
import { DoctorConnection } from '../common/entities/pagination.entity';
import { CreateDoctorInput } from './dto/create-doctor.input';
import { UpdateDoctorInput } from './dto/update-doctor.input';

/**
 * GraphQL resolver for doctor operations.
 * Handles all CRUD mutations and queries for doctor management.
 * All operations are protected by AuthGuard (applied globally).
 */
@Resolver(() => Doctor)
export class DoctorsResolver {
  constructor(private readonly doctorsService: DoctorsService) {}

  /**
   * Create a new doctor record.
   * 
   * @param name - Full name of the doctor
   * @returns Created doctor entity
   * @throws GraphQLError with code CONFLICT if creation fails
   */
  @Mutation(() => Doctor, {
    description: 'Create a new doctor record. Requires authentication.',
  })
  async createDoctor(
    @Args('name', { 
      type: () => String, 
      description: 'Full name of the doctor. Example: Dr. Jane Smith' 
    }) name: string,
  ): Promise<Doctor> {
    const createDoctorInput: CreateDoctorInput = { name };
    return this.doctorsService.create(createDoctorInput);
  }

  /**
   * Update an existing doctor record.
   * 
   * @param id - Doctor UUID to update
   * @param name - New name for the doctor (optional)
   * @returns Updated doctor entity
   * @throws GraphQLError with code NOT_FOUND if doctor doesn't exist
   */
  @Mutation(() => Doctor, {
    description: 'Update an existing doctor record. Requires authentication.',
  })
  async updateDoctor(
    @Args('id', { 
      type: () => ID, 
      description: 'Unique identifier of the doctor to update' 
    }) id: string,
    @Args('name', { 
      type: () => String, 
      nullable: true,
      description: 'New name for the doctor (optional)' 
    }) name?: string,
  ): Promise<Doctor> {
    const updateDoctorInput: UpdateDoctorInput = { id, name };
    return this.doctorsService.update(id, updateDoctorInput);
  }

  /**
   * Delete a doctor record.
   * Enforces referential integrity - cannot delete doctor with existing schedules.
   * 
   * @param id - Doctor UUID to delete
   * @returns true if deletion successful
   * @throws GraphQLError with code CONSTRAINT_VIOLATION if doctor has schedules
   * @throws GraphQLError with code NOT_FOUND if doctor doesn't exist
   */
  @Mutation(() => Boolean, {
    description: 'Delete a doctor record. Cannot delete if doctor has existing schedules. Requires authentication.',
  })
  async deleteDoctor(
    @Args('id', { 
      type: () => ID, 
      description: 'Unique identifier of the doctor to delete' 
    }) id: string,
  ): Promise<boolean> {
    return this.doctorsService.delete(id);
  }

  /**
   * Retrieve paginated list of all doctors.
   * 
   * @param page - Page number (default: 1, minimum: 1)
   * @param limit - Results per page (default: 10, minimum: 1, maximum: 100)
   * @returns Paginated doctor connection with metadata
   */
  @Query(() => DoctorConnection, {
    description: 'Retrieve paginated list of all doctors. Requires authentication.',
  })
  async doctors(
    @Args('page', { 
      type: () => Int, 
      nullable: true, 
      defaultValue: 1,
      description: 'Page number (default: 1, minimum: 1)' 
    }) page?: number,
    @Args('limit', { 
      type: () => Int, 
      nullable: true, 
      defaultValue: 10,
      description: 'Results per page (default: 10, minimum: 1, maximum: 100)' 
    }) limit?: number,
  ): Promise<DoctorConnection> {
    return this.doctorsService.findAll(page, limit);
  }

  /**
   * Retrieve a single doctor by ID.
   * 
   * @param id - Doctor UUID
   * @returns Doctor entity
   * @throws GraphQLError with code NOT_FOUND if doctor doesn't exist
   */
  @Query(() => Doctor, {
    description: 'Retrieve a single doctor by ID. Requires authentication.',
  })
  async doctor(
    @Args('id', { 
      type: () => ID, 
      description: 'Unique identifier of the doctor' 
    }) id: string,
  ): Promise<Doctor> {
    return this.doctorsService.findOne(id);
  }
}
