import { Test, TestingModule } from '@nestjs/testing';
import { CustomersResolver } from './customers.resolver';
import { CustomersService } from './customers.service';
import { Customer } from './entities/customer.entity';
import { CustomerConnection } from '../common/entities/pagination.entity';

describe('CustomersResolver', () => {
  let resolver: CustomersResolver;
  let service: CustomersService;

  const mockCustomersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersResolver,
        {
          provide: CustomersService,
          useValue: mockCustomersService,
        },
      ],
    }).compile();

    resolver = module.get<CustomersResolver>(CustomersResolver);
    service = module.get<CustomersService>(CustomersService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('createCustomer', () => {
    const mockCustomer: Customer = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Doe',
      email: 'john.doe@example.com',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    };

    it('should create a new customer', async () => {
      // Arrange
      mockCustomersService.create.mockResolvedValue(mockCustomer);

      // Act
      const result = await resolver.createCustomer('John Doe', 'john.doe@example.com');

      // Assert
      expect(mockCustomersService.create).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john.doe@example.com',
      });
      expect(result).toEqual(mockCustomer);
    });

    it('should pass through service errors', async () => {
      // Arrange
      const error = new Error('Email already exists');
      mockCustomersService.create.mockRejectedValue(error);

      // Act & Assert
      await expect(
        resolver.createCustomer('John Doe', 'john.doe@example.com')
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('updateCustomer', () => {
    const mockUpdatedCustomer: Customer = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Updated',
      email: 'john.updated@example.com',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-03T00:00:00Z'),
    };

    it('should update a customer with all fields', async () => {
      // Arrange
      mockCustomersService.update.mockResolvedValue(mockUpdatedCustomer);

      // Act
      const result = await resolver.updateCustomer(
        '123e4567-e89b-12d3-a456-426614174000',
        'John Updated',
        'john.updated@example.com'
      );

      // Assert
      expect(mockCustomersService.update).toHaveBeenCalledWith({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Updated',
        email: 'john.updated@example.com',
      });
      expect(result).toEqual(mockUpdatedCustomer);
    });

    it('should update a customer with only name', async () => {
      // Arrange
      mockCustomersService.update.mockResolvedValue(mockUpdatedCustomer);

      // Act
      await resolver.updateCustomer(
        '123e4567-e89b-12d3-a456-426614174000',
        'John Updated',
        undefined
      );

      // Assert
      expect(mockCustomersService.update).toHaveBeenCalledWith({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Updated',
        email: undefined,
      });
    });

    it('should update a customer with only email', async () => {
      // Arrange
      mockCustomersService.update.mockResolvedValue(mockUpdatedCustomer);

      // Act
      await resolver.updateCustomer(
        '123e4567-e89b-12d3-a456-426614174000',
        undefined,
        'john.updated@example.com'
      );

      // Assert
      expect(mockCustomersService.update).toHaveBeenCalledWith({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: undefined,
        email: 'john.updated@example.com',
      });
    });

    it('should pass through service errors', async () => {
      // Arrange
      const error = new Error('Customer not found');
      mockCustomersService.update.mockRejectedValue(error);

      // Act & Assert
      await expect(
        resolver.updateCustomer(
          '123e4567-e89b-12d3-a456-426614174000',
          'John Updated',
          'john.updated@example.com'
        )
      ).rejects.toThrow('Customer not found');
    });
  });

  describe('deleteCustomer', () => {
    it('should delete a customer successfully', async () => {
      // Arrange
      mockCustomersService.delete.mockResolvedValue(true);

      // Act
      const result = await resolver.deleteCustomer('123e4567-e89b-12d3-a456-426614174000');

      // Assert
      expect(mockCustomersService.delete).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000'
      );
      expect(result).toBe(true);
    });

    it('should pass through service errors', async () => {
      // Arrange
      const error = new Error('Cannot delete customer with existing schedules');
      mockCustomersService.delete.mockRejectedValue(error);

      // Act & Assert
      await expect(
        resolver.deleteCustomer('123e4567-e89b-12d3-a456-426614174000')
      ).rejects.toThrow('Cannot delete customer with existing schedules');
    });
  });

  describe('customers', () => {
    const mockCustomers: Customer[] = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john.doe@example.com',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      },
      {
        id: '223e4567-e89b-12d3-a456-426614174001',
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        createdAt: new Date('2024-01-02T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      },
    ];

    const mockCustomerConnection: CustomerConnection = {
      data: mockCustomers,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalCount: 2,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    it('should return paginated customers with default parameters', async () => {
      // Arrange
      mockCustomersService.findAll.mockResolvedValue(mockCustomerConnection);

      // Act
      const result = await resolver.customers();

      // Assert
      expect(mockCustomersService.findAll).toHaveBeenCalledWith(undefined, undefined);
      expect(result).toEqual(mockCustomerConnection);
    });

    it('should return paginated customers with custom page and limit', async () => {
      // Arrange
      mockCustomersService.findAll.mockResolvedValue(mockCustomerConnection);

      // Act
      const result = await resolver.customers(2, 20);

      // Assert
      expect(mockCustomersService.findAll).toHaveBeenCalledWith(2, 20);
      expect(result).toEqual(mockCustomerConnection);
    });

    it('should handle service layer pagination validation', async () => {
      // Arrange
      mockCustomersService.findAll.mockResolvedValue(mockCustomerConnection);

      // Act
      await resolver.customers(0, 150); // Invalid page and limit

      // Assert
      expect(mockCustomersService.findAll).toHaveBeenCalledWith(0, 150);
      // Service layer should validate and constrain these values
    });
  });

  describe('customer', () => {
    const mockCustomer: Customer = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Doe',
      email: 'john.doe@example.com',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    };

    it('should return a single customer by ID', async () => {
      // Arrange
      mockCustomersService.findOne.mockResolvedValue(mockCustomer);

      // Act
      const result = await resolver.customer('123e4567-e89b-12d3-a456-426614174000');

      // Assert
      expect(mockCustomersService.findOne).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000'
      );
      expect(result).toEqual(mockCustomer);
    });

    it('should pass through service errors', async () => {
      // Arrange
      const error = new Error('Customer not found');
      mockCustomersService.findOne.mockRejectedValue(error);

      // Act & Assert
      await expect(
        resolver.customer('nonexistent-id')
      ).rejects.toThrow('Customer not found');
    });
  });
});
