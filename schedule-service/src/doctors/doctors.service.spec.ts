import { Test, TestingModule } from '@nestjs/testing';
import { GraphQLError } from 'graphql';
import { DoctorsService } from './doctors.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CreateDoctorInput } from './dto/create-doctor.input';
import { UpdateDoctorInput } from './dto/update-doctor.input';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

describe('DoctorsService', () => {
  let service: DoctorsService;
  let prisma: PrismaService;
  let cacheService: CacheService;

  const mockPrismaService = {
    doctor: {
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
    del: jest.fn(),
    invalidatePattern: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DoctorsService,
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

    service = module.get<DoctorsService>(DoctorsService);
    prisma = module.get<PrismaService>(PrismaService);
    cacheService = module.get<CacheService>(CacheService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDoctorInput: CreateDoctorInput = {
      name: 'Dr. Jane Smith',
    };

    const mockDoctor = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Dr. Jane Smith',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    };

    it('should successfully create a new doctor and invalidate cache', async () => {
      // Arrange
      mockPrismaService.doctor.create.mockResolvedValue(mockDoctor);
      mockCacheService.invalidatePattern.mockResolvedValue(undefined);

      // Act
      const result = await service.create(createDoctorInput);

      // Assert
      expect(mockPrismaService.doctor.create).toHaveBeenCalledWith({
        data: {
          name: 'Dr. Jane Smith',
        },
      });
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('doctors:*');
      expect(result).toEqual(mockDoctor);
    });

    it('should rethrow unexpected errors', async () => {
      // Arrange
      const unexpectedError = new Error('Database connection failed');
      mockPrismaService.doctor.create.mockRejectedValue(unexpectedError);

      // Act & Assert
      await expect(service.create(createDoctorInput)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('findAll', () => {
    const mockDoctors = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Dr. Jane Smith',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      },
      {
        id: '223e4567-e89b-12d3-a456-426614174001',
        name: 'Dr. John Doe',
        createdAt: new Date('2024-01-02T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      },
    ];

    it('should return cached data when cache hit occurs', async () => {
      // Arrange
      const cachedResult = {
        data: mockDoctors,
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
      expect(mockCacheService.get).toHaveBeenCalledWith('doctors:list:page:1:limit:10');
      expect(result).toEqual(cachedResult);
      expect(mockPrismaService.doctor.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.doctor.count).not.toHaveBeenCalled();
    });

    it('should query database and cache result when cache miss occurs', async () => {
      // Arrange
      const totalCount = 2;
      mockCacheService.get.mockResolvedValue(null); // Cache miss
      mockPrismaService.doctor.findMany.mockResolvedValue(mockDoctors);
      mockPrismaService.doctor.count.mockResolvedValue(totalCount);
      mockCacheService.set.mockResolvedValue(undefined);

      // Act
      const result = await service.findAll(1, 10);

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith('doctors:list:page:1:limit:10');
      expect(mockPrismaService.doctor.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrismaService.doctor.count).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'doctors:list:page:1:limit:10',
        {
          data: mockDoctors,
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCount: 2,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
        300, // 5 minutes TTL
      );
      expect(result.data).toEqual(mockDoctors);
    });

    it('should return paginated doctors with default page=1 and limit=10', async () => {
      // Arrange
      const totalCount = 2;
      mockCacheService.get.mockResolvedValue(null); // Cache miss
      mockPrismaService.doctor.findMany.mockResolvedValue(mockDoctors);
      mockPrismaService.doctor.count.mockResolvedValue(totalCount);
      mockCacheService.set.mockResolvedValue(undefined);

      // Act
      const result = await service.findAll(1, 10);

      // Assert
      expect(mockPrismaService.doctor.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrismaService.doctor.count).toHaveBeenCalled();
      expect(result.data).toEqual(mockDoctors);
      expect(result.pagination).toEqual({
        currentPage: 1,
        totalPages: 1,
        totalCount: 2,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('should calculate correct skip value for pagination (page=2, limit=10)', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null); // Cache miss
      mockPrismaService.doctor.findMany.mockResolvedValue([]);
      mockPrismaService.doctor.count.mockResolvedValue(25);
      mockCacheService.set.mockResolvedValue(undefined);

      // Act
      await service.findAll(2, 10);

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith('doctors:list:page:2:limit:10');
      expect(mockPrismaService.doctor.findMany).toHaveBeenCalledWith({
        skip: 10, // (2-1) * 10 = 10
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return correct pagination metadata with multiple pages', async () => {
      // Arrange
      const totalCount = 25;
      mockCacheService.get.mockResolvedValue(null); // Cache miss
      mockPrismaService.doctor.findMany.mockResolvedValue(mockDoctors);
      mockPrismaService.doctor.count.mockResolvedValue(totalCount);
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
      mockPrismaService.doctor.findMany.mockResolvedValue(mockDoctors);
      mockPrismaService.doctor.count.mockResolvedValue(totalCount);
      mockCacheService.set.mockResolvedValue(undefined);

      // Act
      const result = await service.findAll(2, 10);

      // Assert
      expect(result.pagination.hasNextPage).toBe(false); // 2 * 10 (20) = 20
    });

    it('should enforce minimum page value of 1', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null); // Cache miss
      mockPrismaService.doctor.findMany.mockResolvedValue([]);
      mockPrismaService.doctor.count.mockResolvedValue(0);
      mockCacheService.set.mockResolvedValue(undefined);

      // Act
      await service.findAll(0, 10); // Invalid page value

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith('doctors:list:page:1:limit:10');
      expect(mockPrismaService.doctor.findMany).toHaveBeenCalledWith({
        skip: 0, // Should use page=1 (minimum)
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should enforce minimum limit value of 1', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null); // Cache miss
      mockPrismaService.doctor.findMany.mockResolvedValue([]);
      mockPrismaService.doctor.count.mockResolvedValue(0);
      mockCacheService.set.mockResolvedValue(undefined);

      // Act
      await service.findAll(1, 0); // Invalid limit value

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith('doctors:list:page:1:limit:1');
      expect(mockPrismaService.doctor.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 1, // Should use limit=1 (minimum)
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should enforce maximum limit value of 100', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null); // Cache miss
      mockPrismaService.doctor.findMany.mockResolvedValue([]);
      mockPrismaService.doctor.count.mockResolvedValue(0);
      mockCacheService.set.mockResolvedValue(undefined);

      // Act
      await service.findAll(1, 150); // Exceeds maximum

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith('doctors:list:page:1:limit:100');
      expect(mockPrismaService.doctor.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 100, // Should use limit=100 (maximum)
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should query total count and data in parallel', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null); // Cache miss
      const findManyPromise = Promise.resolve(mockDoctors);
      const countPromise = Promise.resolve(2);
      mockPrismaService.doctor.findMany.mockReturnValue(findManyPromise);
      mockPrismaService.doctor.count.mockReturnValue(countPromise);
      mockCacheService.set.mockResolvedValue(undefined);

      // Act
      await service.findAll(1, 10);

      // Assert
      expect(mockPrismaService.doctor.findMany).toHaveBeenCalled();
      expect(mockPrismaService.doctor.count).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    const mockDoctor = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Dr. Jane Smith',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    };

    it('should return doctor when found', async () => {
      // Arrange
      mockPrismaService.doctor.findUnique.mockResolvedValue(mockDoctor);

      // Act
      const result = await service.findOne('123e4567-e89b-12d3-a456-426614174000');

      // Assert
      expect(mockPrismaService.doctor.findUnique).toHaveBeenCalledWith({
        where: { id: '123e4567-e89b-12d3-a456-426614174000' },
      });
      expect(result).toEqual(mockDoctor);
    });

    it('should throw NOT_FOUND error when doctor does not exist', async () => {
      // Arrange
      mockPrismaService.doctor.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('nonexistent-id')).rejects.toThrow(GraphQLError);

      try {
        await service.findOne('nonexistent-id');
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect(error.message).toBe('Doctor not found');
        expect(error.extensions.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('update', () => {
    const doctorId = '123e4567-e89b-12d3-a456-426614174000';
    const updateDoctorInput: UpdateDoctorInput = {
      id: doctorId,
      name: 'Dr. Jane Updated',
    };

    const mockUpdatedDoctor = {
      id: doctorId,
      name: 'Dr. Jane Updated',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-03T00:00:00Z'),
    };

    it('should successfully update a doctor and invalidate cache', async () => {
      // Arrange
      mockPrismaService.doctor.update.mockResolvedValue(mockUpdatedDoctor);
      mockCacheService.invalidatePattern.mockResolvedValue(undefined);

      // Act
      const result = await service.update(doctorId, updateDoctorInput);

      // Assert
      expect(mockPrismaService.doctor.update).toHaveBeenCalledWith({
        where: { id: doctorId },
        data: {
          id: doctorId,
          name: 'Dr. Jane Updated',
        },
      });
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('doctors:*');
      expect(result).toEqual(mockUpdatedDoctor);
    });

    it('should throw NOT_FOUND error when doctor does not exist (P2025)', async () => {
      // Arrange
      const nonExistentId = 'nonexistent-id';
      const updateInput: UpdateDoctorInput = {
        id: nonExistentId,
        name: 'Dr. Jane Updated',
      };
      const prismaError = new PrismaClientKnownRequestError(
        'Record to update not found',
        {
          code: 'P2025',
          clientVersion: '5.0.0',
          meta: { cause: 'Record to update not found.' },
        }
      );
      mockPrismaService.doctor.update.mockRejectedValue(prismaError);

      // Act & Assert
      await expect(service.update(nonExistentId, updateInput)).rejects.toThrow(GraphQLError);

      try {
        await service.update(nonExistentId, updateInput);
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect(error.message).toBe('Doctor not found');
        expect(error.extensions.code).toBe('NOT_FOUND');
      }
    });

    it('should rethrow unexpected errors', async () => {
      // Arrange
      const unexpectedError = new Error('Database connection failed');
      mockPrismaService.doctor.update.mockRejectedValue(unexpectedError);

      // Act & Assert
      await expect(service.update(doctorId, updateDoctorInput)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('delete', () => {
    const doctorId = '123e4567-e89b-12d3-a456-426614174000';

    it('should successfully delete a doctor and invalidate cache', async () => {
      // Arrange
      mockPrismaService.doctor.delete.mockResolvedValue({
        id: doctorId,
        name: 'Dr. Jane Smith',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });
      mockCacheService.invalidatePattern.mockResolvedValue(undefined);

      // Act
      const result = await service.delete(doctorId);

      // Assert
      expect(mockPrismaService.doctor.delete).toHaveBeenCalledWith({
        where: { id: doctorId },
      });
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('doctors:*');
      expect(result).toBe(true);
    });

    it('should throw CONSTRAINT_VIOLATION error when doctor has existing schedules (P2003)', async () => {
      // Arrange
      const prismaError = new PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        {
          code: 'P2003',
          clientVersion: '5.0.0',
          meta: { field_name: 'doctorId' },
        }
      );
      mockPrismaService.doctor.delete.mockRejectedValue(prismaError);

      // Act & Assert
      await expect(service.delete(doctorId)).rejects.toThrow(GraphQLError);

      try {
        await service.delete(doctorId);
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect(error.message).toBe('Cannot delete doctor with existing schedules');
        expect(error.extensions.code).toBe('CONSTRAINT_VIOLATION');
      }
    });

    it('should throw NOT_FOUND error when doctor does not exist (P2025)', async () => {
      // Arrange
      const prismaError = new PrismaClientKnownRequestError(
        'Record to delete not found',
        {
          code: 'P2025',
          clientVersion: '5.0.0',
          meta: { cause: 'Record to delete does not exist.' },
        }
      );
      mockPrismaService.doctor.delete.mockRejectedValue(prismaError);

      // Act & Assert
      await expect(service.delete(doctorId)).rejects.toThrow(GraphQLError);

      try {
        await service.delete(doctorId);
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect(error.message).toBe('Doctor not found');
        expect(error.extensions.code).toBe('NOT_FOUND');
      }
    });

    it('should rethrow unexpected errors', async () => {
      // Arrange
      const unexpectedError = new Error('Database connection failed');
      mockPrismaService.doctor.delete.mockRejectedValue(unexpectedError);

      // Act & Assert
      await expect(service.delete(doctorId)).rejects.toThrow('Database connection failed');
    });
  });
});
