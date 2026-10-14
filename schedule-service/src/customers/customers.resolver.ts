import { Resolver, Mutation, Query, Args, Int, ID } from '@nestjs/graphql';
import { CustomersService } from './customers.service';
import { CreateCustomerInput } from './dto/create-customer.input';
import { UpdateCustomerInput } from './dto/update-customer.input';
import { Customer } from './entities/customer.entity';
import { CustomerConnection } from '../common/entities/pagination.entity';

/**
 * GraphQL resolver for customer operations.
 * Handles customer mutations and queries with authentication and pagination.
 * 
 * */
@Resolver(() => Customer)
export class CustomersResolver {
  constructor(private readonly customersService: CustomersService) {}

  /**
   * Create a new customer with name and email.
   * 
   * @param createCustomerInput - Customer data (name and email)
   * @returns The created customer record
   * @throws GraphQLError with code CONFLICT if email already exists
   * @throws GraphQLError with code INVALID_INPUT if validation fails
   * 
   *   */
  @Mutation(() => Customer, {
    description: 'Create a new customer record. Requires authentication. Returns the created customer.',
  })
  async createCustomer(
    @Args('name', { 
      type: () => String, 
      description: 'Full name of the customer' 
    }) name: string,
    @Args('email', { 
      type: () => String, 
      description: 'Email address of the customer (must be unique)' 
    }) email: string,
  ): Promise<Customer> {
    const createCustomerInput: CreateCustomerInput = { name, email };
    return this.customersService.create(createCustomerInput);
  }

  /**
   * Update an existing customer record.
   * 
   * @param id - Customer UUID to update
   * @param name - Optional new name
   * @param email - Optional new email
   * @returns The updated customer record
   * @throws GraphQLError with code CONFLICT if new email already exists
   * @throws GraphQLError with code NOT_FOUND if customer does not exist
   * 
   *   */
  @Mutation(() => Customer, {
    description: 'Update an existing customer record. Requires authentication. All fields except ID are optional.',
  })
  async updateCustomer(
    @Args('id', { 
      type: () => ID, 
      description: 'Unique identifier of the customer to update' 
    }) id: string,
    @Args('name', { 
      type: () => String, 
      nullable: true, 
      description: 'New name for the customer (optional)' 
    }) name?: string,
    @Args('email', { 
      type: () => String, 
      nullable: true, 
      description: 'New email address for the customer (optional, must be unique)' 
    }) email?: string,
  ): Promise<Customer> {
    const updateCustomerInput: UpdateCustomerInput = { id, name, email };
    return this.customersService.update(updateCustomerInput);
  }

  /**
   * Delete a customer by ID.
   * 
   * @param id - Customer UUID to delete
   * @returns true if deletion was successful
   * @throws GraphQLError with code CONSTRAINT_VIOLATION if customer has existing schedules
   * @throws GraphQLError with code NOT_FOUND if customer does not exist
   * 
   *   */
  @Mutation(() => Boolean, {
    description: 'Delete a customer by ID. Requires authentication. Cannot delete customers with existing schedules.',
  })
  async deleteCustomer(
    @Args('id', { 
      type: () => ID, 
      description: 'Unique identifier of the customer to delete' 
    }) id: string,
  ): Promise<boolean> {
    return this.customersService.delete(id);
  }

  /**
   * Retrieve a paginated list of all customers.
   * 
   * @param page - Page number (default: 1, minimum: 1)
   * @param limit - Items per page (default: 10, minimum: 1, maximum: 100)
   * @returns CustomerConnection with paginated data and metadata
   * 
   *   */
  @Query(() => CustomerConnection, {
    description: 'Retrieve a paginated list of all customers. Requires authentication. Supports pagination parameters.',
  })
  async customers(
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
      description: 'Items per page (default: 10, minimum: 1, maximum: 100)' 
    }) limit?: number,
  ): Promise<CustomerConnection> {
    return this.customersService.findAll(page, limit);
  }

  /**
   * Retrieve a single customer by ID.
   * 
   * @param id - Customer UUID
   * @returns The customer record
   * @throws GraphQLError with code NOT_FOUND if customer does not exist
   * 
   *   */
  @Query(() => Customer, {
    description: 'Retrieve a single customer by ID. Requires authentication.',
  })
  async customer(
    @Args('id', { 
      type: () => ID, 
      description: 'Unique identifier of the customer to retrieve' 
    }) id: string,
  ): Promise<Customer> {
    return this.customersService.findOne(id);
  }
}
