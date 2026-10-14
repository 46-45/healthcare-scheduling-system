import { Test, TestingModule } from '@nestjs/testing';
import { GraphQLError } from 'graphql';
import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CreateCustomerInput } from './dto/create-customer.input';
import { UpdateCustomerInput } from './dto/update-customer.input';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

describe('CustomersService', () => {
  let service: CustomersService;
  let prisma: PrismaService;
  let cacheService: CacheService;

  const mockPrismaService = {
    customer: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    invalidatePattern: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
    prisma = module.get<PrismaService>(PrismaService);
    cacheService = module.get<CacheService>(CacheService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createCustomerInput: CreateCustomerInput = {
      name: 'John Doe',
      email: 'john.doe@example.com',
    };

    const mockCustomer = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Doe',
      email: 'john.doe@example.com',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    };

    it('should successfully create a new customer', async () => {
      // Arrange
      mockPrismaService.customer.create.mockResolvedValue(mockCustomer);
      mockCacheService.invalidatePattern.mockResolvedValue(undefined);

      // Act
      const result = await service.create(createCustomerInput);

      // Assert
      expect(mockPrismaService.customer.create).toHaveBeenCalledWith({
        data: {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
      });
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('customers:*');
      expect(result).toEqual(mockCustomer);
    });

    it('should throw CONFLICT error when email already exists (P2002)', async () => {
      // Arrange
      const prismaError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
          meta: { target: ['email'] },
        }
      );
      mockPrismaService.customer.create.mockRejectedValue(prismaError);

      // Act & Assert
      await expect(service.create(createCustomerInput)).rejects.toThrow(GraphQLError);

      try {
        await service.create(createCustomerInput);
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect(error.message).toBe('Email already exists');
        expect(error.extensions.code).toBe('CONFLICT');
      }
    });

    it('should rethrow unexpected errors', async () => {
      // Arrange
      const unexpectedError = new Error('Database connection failed');
      mockPrismaService.customer.create.mockRejectedValue(unexpectedError);

      // Act & Assert
      await expect(service.create(createCustomerInput)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('findAll', () => {
    const mockCustomers = [
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

    it('should return paginated customers with default page=1 and limit=10', async () => {
      // Arrange
      const totalCount = 2;
      mockCacheService.get.mockResolvedValue(null); // Cache miss
      mockPrismaService.customer.findMany.mockResolvedValue(mockCustomers);
      mockPrismaService.customer.count.mockResolvedValue(totalCount);
      mockCacheService.set.mockResolvedValue(undefined);

      // Act
      const result = await service.findAll(1, 10);

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith('customers:list:page:1:limit:10');
      expect(mockPrismaService.customer.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrismaService.customer.count).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'customers:list:page:1:limit:10',
        expect.objectContaining({
          data: mockCustomers,
          pagination: expect.any(Object),
        }),
        300,
      );
      expect(result.data).toEqual(mockCustomers);
      expect(result.pagination).toEqual({
        currentPage: 1,
        totalPages: 1,
        totalCount: 2,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('should return cached data when cache hit occurs', async () => {
      // Arrange
      const cachedResult = {
        data: mockCustomers,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: 2,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
      mockCacheService.get.mockResolvedValue(cachedResult);

      // Act
      const result = await service.findAll(1, 10);

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith('customers:list:page:1:limit:10');
      expect(mockPrismaService.customer.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.customer.count).not.toHaveBeenCalled();
      expect(mockCacheService.set).not.toHaveBeenCalled();
      expect(result).toEqual(cachedResult);
    });

    it('should calculate correct skip value for pagination (page=2, limit=10)', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null); // Cache miss
      mockPrismaService.customer.findMany.mockResolvedValue([]);
      mockPrismaService.customer.count.mockResolvedValue(25);
      mockCacheService.set.mockResolvedValue(undefined);

      // Act
      await service.findAll(2, 10);

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith('customers:list:page:2:limit:10');
      expect(mockPrismaService.customer.findMany).toHaveBeenCalledWith({
        skip: 10, // (2-1) * 10 = 10
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return correct pagination metadata with multiple pages', async () => {
      // Arrange
      const totalCount = 25;
      mockCacheService.get.mockResolvedValue(null); // Cache miss
      mockPrismaService.customer.findMany.mockResolvedValue(mockCustomers);
      mockPrismaService.customer.count.mockResolvedValue(totalCount);
      mockCacheService.set.mockResolvedValue(undefined);

      // Act
      const result = await service.findAll(2, 10);

      // Assert
      expect(result.pagination).toEqual({
        currentPage: 2,
        totalPages: 3, // Math.ceil(25/10) = 3
        totalCount: 25,
        hasNextPage: true, // 2 * 10 (20) < 25
        hasPreviousPage: true, // 2 > 1
      });
    });

    it('should indicate hasNextPage=false on last page', async () => {
      // Arrange
      const totalCount = 20;
      mockCacheService.get.mockResolvedValue(null); // Cache miss
      mockPrismaService.customer.findMany.mockResolvedValue(mockCustomers);
      mockPrismaService.customer.count.mockResolvedValue(totalCount);
      mockCacheService.set.mockResolvedValue(undefined);

      // Act
      const result = await service.findAll(2, 10);

      // Assert
      expect(result.pagination.hasNextPage).toBe(false); // 2 * 10 (20) = 20
    });

    it('should enforce minimum page value of 1', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null); // Cache miss
      mockPrismaService.customer.findMany.mockResolvedValue([]);
      mockPrismaService.customer.count.mockResolvedValue(0);
      mockCacheService.set.mockResolvedValue(undefined);

      // Act
      await service.findAll(0, 10); // Invalid page value

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith('customers:list:page:1:limit:10');
      expect(mockPrismaService.customer.findMany).toHaveBeenCalledWith({
        skip: 0, // Should use page=1 (minimum)
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should enforce minimum limit value of 1', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null); // Cache miss
      mockPrismaService.customer.findMany.mockResolvedValue([]);
      mockPrismaService.customer.count.mockResolvedValue(0);
      mockCacheService.set.mockResolvedValue(undefined);

      // Act
      await service.findAll(1, 0); // Invalid limit value

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith('customers:list:page:1:limit:1');
      expect(mockPrismaService.customer.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 1, // Should use limit=1 (minimum)
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should enforce maximum limit value of 100', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null); // Cache miss
      mockPrismaService.customer.findMany.mockResolvedValue([]);
      mockPrismaService.customer.count.mockResolvedValue(0);
      mockCacheService.set.mockResolvedValue(undefined);

      // Act
      await service.findAll(1, 150); // Exceeds maximum

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith('customers:list:page:1:limit:100');
      expect(mockPrismaService.customer.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 100, // Should use limit=100 (maximum)
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should query total count and data in parallel', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null); // Cache miss
      const findManyPromise = Promise.resolve(mockCustomers);
      const countPromise = Promise.resolve(2);
      mockPrismaService.customer.findMany.mockReturnValue(findManyPromise);
      mockPrismaService.customer.count.mockReturnValue(countPromise);
      mockCacheService.set.mockResolvedValue(undefined);

      // Act
      await service.findAll(1, 10);

      // Assert
      expect(mockPrismaService.customer.findMany).toHaveBeenCalled();
      expect(mockPrismaService.customer.count).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    const mockCustomer = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Doe',
      email: 'john.doe@example.com',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    };

    it('should return customer when found', async () => {
      // Arrange
      mockPrismaService.customer.findUnique.mockResolvedValue(mockCustomer);

      // Act
      const result = await service.findOne('123e4567-e89b-12d3-a456-426614174000');

      // Assert
      expect(mockPrismaService.customer.findUnique).toHaveBeenCalledWith({
        where: { id: '123e4567-e89b-12d3-a456-426614174000' },
      });
      expect(result).toEqual(mockCustomer);
    });

    it('should throw NOT_FOUND error when customer does not exist', async () => {
      // Arrange
      mockPrismaService.customer.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('nonexistent-id')).rejects.toThrow(GraphQLError);

      try {
        await service.findOne('nonexistent-id');
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect(error.message).toBe('Customer not found');
        expect(error.extensions.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('update', () => {
    const updateCustomerInput: UpdateCustomerInput = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Updated',
      email: 'john.updated@example.com',
    };

    const mockUpdatedCustomer = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Updated',
      email: 'john.updated@example.com',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-03T00:00:00Z'),
    };

    it('should successfully update a customer', async () => {
      // Arrange
      mockPrismaService.customer.update.mockResolvedValue(mockUpdatedCustomer);
      mockCacheService.invalidatePattern.mockResolvedValue(undefined);

      // Act
      const result = await service.update(updateCustomerInput);

      // Assert
      expect(mockPrismaService.customer.update).toHaveBeenCalledWith({
        where: { id: '123e4567-e89b-12d3-a456-426614174000' },
        data: {
          name: 'John Updated',
          email: 'john.updated@example.com',
        },
      });
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('customers:*');
      expect(result).toEqual(mockUpdatedCustomer);
    });

    it('should update with only name field', async () => {
      // Arrange
      const partialUpdate: UpdateCustomerInput = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Updated',
      };
      mockPrismaService.customer.update.mockResolvedValue(mockUpdatedCustomer);
      mockCacheService.invalidatePattern.mockResolvedValue(undefined);

      // Act
      await service.update(partialUpdate);

      // Assert
      expect(mockPrismaService.customer.update).toHaveBeenCalledWith({
        where: { id: '123e4567-e89b-12d3-a456-426614174000' },
        data: {
          name: 'John Updated',
        },
      });
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('customers:*');
    });

    it('should update with only email field', async () => {
      // Arrange
      const partialUpdate: UpdateCustomerInput = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'john.updated@example.com',
      };
      mockPrismaService.customer.update.mockResolvedValue(mockUpdatedCustomer);
      mockCacheService.invalidatePattern.mockResolvedValue(undefined);

      // Act
      await service.update(partialUpdate);

      // Assert
      expect(mockPrismaService.customer.update).toHaveBeenCalledWith({
        where: { id: '123e4567-e89b-12d3-a456-426614174000' },
        data: {
          email: 'john.updated@example.com',
        },
      });
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('customers:*');
    });

    it('should throw CONFLICT error when new email already exists (P2002)', async () => {
      // Arrange
      const prismaError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
          meta: { target: ['email'] },
        }
      );
      mockPrismaService.customer.update.mockRejectedValue(prismaError);

      // Act & Assert
      await expect(service.update(updateCustomerInput)).rejects.toThrow(GraphQLError);

      try {
        await service.update(updateCustomerInput);
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect(error.message).toBe('Email already exists');
        expect(error.extensions.code).toBe('CONFLICT');
      }
    });

    it('should throw NOT_FOUND error when customer does not exist (P2025)', async () => {
      // Arrange
      const prismaError = new PrismaClientKnownRequestError(
        'Record to update not found',
        {
          code: 'P2025',
          clientVersion: '5.0.0',
          meta: { cause: 'Record to update not found.' },
        }
      );
      mockPrismaService.customer.update.mockRejectedValue(prismaError);

      // Act & Assert
      await expect(service.update(updateCustomerInput)).rejects.toThrow(GraphQLError);

      try {
        await service.update(updateCustomerInput);
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect(error.message).toBe('Customer not found');
        expect(error.extensions.code).toBe('NOT_FOUND');
      }
    });

    it('should rethrow unexpected errors', async () => {
      // Arrange
      const unexpectedError = new Error('Database connection failed');
      mockPrismaService.customer.update.mockRejectedValue(unexpectedError);

      // Act & Assert
      await expect(service.update(updateCustomerInput)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('delete', () => {
    const customerId = '123e4567-e89b-12d3-a456-426614174000';

    it('should successfully delete a customer', async () => {
      // Arrange
      mockPrismaService.customer.delete.mockResolvedValue({
        id: customerId,
        name: 'John Doe',
        email: 'john.doe@example.com',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });
      mockCacheService.invalidatePattern.mockResolvedValue(undefined);

      // Act
      const result = await service.delete(customerId);

      // Assert
      expect(mockPrismaService.customer.delete).toHaveBeenCalledWith({
        where: { id: customerId },
      });
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('customers:*');
      expect(result).toBe(true);
    });

    it('should throw CONSTRAINT_VIOLATION error when customer has existing schedules (P2003)', async () => {
      // Arrange
      const prismaError = new PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        {
          code: 'P2003',
          clientVersion: '5.0.0',
          meta: { field_name: 'customerId' },
        }
      );
      mockPrismaService.customer.delete.mockRejectedValue(prismaError);

      // Act & Assert
      await expect(service.delete(customerId)).rejects.toThrow(GraphQLError);

      try {
        await service.delete(customerId);
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect(error.message).toBe('Cannot delete customer with existing schedules');
        expect(error.extensions.code).toBe('CONSTRAINT_VIOLATION');
      }
    });

    it('should throw NOT_FOUND error when customer does not exist (P2025)', async () => {
      // Arrange
      const prismaError = new PrismaClientKnownRequestError(
        'Record to delete not found',
        {
          code: 'P2025',
          clientVersion: '5.0.0',
          meta: { cause: 'Record to delete does not exist.' },
        }
      );
      mockPrismaService.customer.delete.mockRejectedValue(prismaError);

      // Act & Assert
      await expect(service.delete(customerId)).rejects.toThrow(GraphQLError);

      try {
        await service.delete(customerId);
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect(error.message).toBe('Customer not found');
        expect(error.extensions.code).toBe('NOT_FOUND');
      }
    });

    it('should rethrow unexpected errors', async () => {
      // Arrange
      const unexpectedError = new Error('Database connection failed');
      mockPrismaService.customer.delete.mockRejectedValue(unexpectedError);

      // Act & Assert
      await expect(service.delete(customerId)).rejects.toThrow('Database connection failed');
    });
  });
});
