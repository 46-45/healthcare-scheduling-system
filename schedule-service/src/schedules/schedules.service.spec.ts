import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { SchedulesService } from './schedules.service';
import { PrismaService } from '../prisma/prisma.service';
import { GraphQLError } from 'graphql';
import { Prisma } from '@prisma/client';

describe('SchedulesService', () => {
  let service: SchedulesService;
  let prisma: PrismaService;
  let mockQueue: any;

  const mockCustomer = {
    id: 'customer-uuid-1',
    name: 'John Doe',
    email: 'john@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDoctor = {
    id: 'doctor-uuid-1',
    name: 'Dr. Smith',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSchedule = {
    id: 'schedule-uuid-1',
    customerId: 'customer-uuid-1',
    doctorId: 'doctor-uuid-1',
    scheduledAt: new Date('2026-10-15T07:00:00.000Z'), // UTC
    objective: 'Annual checkup',
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: mockCustomer,
    doctor: mockDoctor,
  };

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulesService,
        {
          provide: PrismaService,
          useValue: {
            customer: {
              findUnique: jest.fn(),
            },
            doctor: {
              findUnique: jest.fn(),
            },
            schedule: {
              create: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              findUnique: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: getQueueToken('notification'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<SchedulesService>(SchedulesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const validInput = {
      customerId: 'customer-uuid-1',
      doctorId: 'doctor-uuid-1',
      scheduledAt: '2026-10-15T14:00:00+07:00',
      objective: 'Annual checkup',
    };

    it('should create a schedule successfully with valid data', async () => {
      // Arrange
      jest.spyOn(prisma.customer, 'findUnique').mockResolvedValue(mockCustomer);
      jest.spyOn(prisma.doctor, 'findUnique').mockResolvedValue(mockDoctor);
      jest.spyOn(prisma.schedule, 'create').mockResolvedValue(mockSchedule);

      // Act
      const result = await service.create(validInput);

      // Assert
      expect(result).toEqual(mockSchedule);
      expect(prisma.customer.findUnique).toHaveBeenCalledWith({
        where: { id: 'customer-uuid-1' },
      });
      expect(prisma.doctor.findUnique).toHaveBeenCalledWith({
        where: { id: 'doctor-uuid-1' },
      });
      expect(prisma.schedule.create).toHaveBeenCalledWith({
        data: {
          customerId: 'customer-uuid-1',
          doctorId: 'doctor-uuid-1',
          scheduledAt: '2026-10-15T07:00:00.000Z', // Converted to UTC
          objective: 'Annual checkup',
        },
        include: {
          customer: true,
          doctor: true,
        },
      });
    });

    it('should throw NOT_FOUND when customer does not exist', async () => {
      // Arrange
      jest.spyOn(prisma.customer, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.doctor, 'findUnique').mockResolvedValue(mockDoctor);

      // Act & Assert
      await expect(service.create(validInput)).rejects.toThrow(
        new GraphQLError('Customer not found', {
          extensions: { code: 'NOT_FOUND' },
        })
      );
      expect(prisma.schedule.create).not.toHaveBeenCalled();
    });

    it('should throw NOT_FOUND when doctor does not exist', async () => {
      // Arrange
      jest.spyOn(prisma.customer, 'findUnique').mockResolvedValue(mockCustomer);
      jest.spyOn(prisma.doctor, 'findUnique').mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(validInput)).rejects.toThrow(
        new GraphQLError('Doctor not found', {
          extensions: { code: 'NOT_FOUND' },
        })
      );
      expect(prisma.schedule.create).not.toHaveBeenCalled();
    });

    describe('scheduledAt format validation', () => {
      it('should throw INVALID_INPUT when scheduledAt lacks timezone offset', async () => {
        // Arrange
        jest.spyOn(prisma.customer, 'findUnique').mockResolvedValue(mockCustomer);
        jest.spyOn(prisma.doctor, 'findUnique').mockResolvedValue(mockDoctor);

        const invalidInput = {
          ...validInput,
          scheduledAt: '2026-10-15T14:00:00', // Missing timezone
        };

        // Act & Assert
        await expect(service.create(invalidInput)).rejects.toThrow(
          new GraphQLError('scheduledAt must be in ISO 8601 format with timezone offset', {
            extensions: { code: 'INVALID_INPUT' },
          })
        );
        expect(prisma.schedule.create).not.toHaveBeenCalled();
      });

      it('should accept scheduledAt with Z timezone indicator', async () => {
        // Arrange
        jest.spyOn(prisma.customer, 'findUnique').mockResolvedValue(mockCustomer);
        jest.spyOn(prisma.doctor, 'findUnique').mockResolvedValue(mockDoctor);
        jest.spyOn(prisma.schedule, 'create').mockResolvedValue(mockSchedule);

        const inputWithZ = {
          ...validInput,
          scheduledAt: '2026-10-15T14:00:00Z',
        };

        // Act
        await service.create(inputWithZ);

        // Assert
        expect(prisma.schedule.create).toHaveBeenCalled();
      });

      it('should accept scheduledAt with positive timezone offset', async () => {
        // Arrange
        jest.spyOn(prisma.customer, 'findUnique').mockResolvedValue(mockCustomer);
        jest.spyOn(prisma.doctor, 'findUnique').mockResolvedValue(mockDoctor);
        jest.spyOn(prisma.schedule, 'create').mockResolvedValue(mockSchedule);

        const inputWithPositiveOffset = {
          ...validInput,
          scheduledAt: '2026-10-15T14:00:00+07:00',
        };

        // Act
        await service.create(inputWithPositiveOffset);

        // Assert
        expect(prisma.schedule.create).toHaveBeenCalled();
      });

      it('should accept scheduledAt with negative timezone offset', async () => {
        // Arrange
        jest.spyOn(prisma.customer, 'findUnique').mockResolvedValue(mockCustomer);
        jest.spyOn(prisma.doctor, 'findUnique').mockResolvedValue(mockDoctor);
        jest.spyOn(prisma.schedule, 'create').mockResolvedValue(mockSchedule);

        const inputWithNegativeOffset = {
          ...validInput,
          scheduledAt: '2026-10-15T14:00:00-05:00',
        };

        // Act
        await service.create(inputWithNegativeOffset);

        // Assert
        expect(prisma.schedule.create).toHaveBeenCalled();
      });
    });

    describe('date validation', () => {
      it('should throw INVALID_INPUT for completely malformed date', async () => {
        // Arrange
        jest.spyOn(prisma.customer, 'findUnique').mockResolvedValue(mockCustomer);
        jest.spyOn(prisma.doctor, 'findUnique').mockResolvedValue(mockDoctor);

        const invalidInput = {
          ...validInput,
          scheduledAt: 'not-a-date+07:00',
        };

        // Act & Assert
        await expect(service.create(invalidInput)).rejects.toThrow(
          new GraphQLError('scheduledAt must be in ISO 8601 format with timezone offset', {
            extensions: { code: 'INVALID_INPUT' },
          })
        );
      });

      it('should throw INVALID_INPUT for invalid calendar date (Feb 30)', async () => {
        // Arrange
        jest.spyOn(prisma.customer, 'findUnique').mockResolvedValue(mockCustomer);
        jest.spyOn(prisma.doctor, 'findUnique').mockResolvedValue(mockDoctor);

        const invalidInput = {
          ...validInput,
          scheduledAt: '2026-02-30T14:00:00+07:00', // Feb 30 doesn't exist
        };

        // Act & Assert
        await expect(service.create(invalidInput)).rejects.toThrow(
          new GraphQLError('scheduledAt contains an invalid date', {
            extensions: { code: 'INVALID_INPUT' },
          })
        );
        expect(prisma.schedule.create).not.toHaveBeenCalled();
      });

      it('should throw INVALID_INPUT for invalid calendar date (month 13)', async () => {
        // Arrange
        jest.spyOn(prisma.customer, 'findUnique').mockResolvedValue(mockCustomer);
        jest.spyOn(prisma.doctor, 'findUnique').mockResolvedValue(mockDoctor);

        const invalidInput = {
          ...validInput,
          scheduledAt: '2026-13-15T14:00:00+07:00', // Month 13 doesn't exist
        };

        // Act & Assert
        await expect(service.create(invalidInput)).rejects.toThrow(
          new GraphQLError('scheduledAt contains an invalid date', {
            extensions: { code: 'INVALID_INPUT' },
          })
        );
        expect(prisma.schedule.create).not.toHaveBeenCalled();
      });

      it('should throw INVALID_INPUT for invalid day (day 32)', async () => {
        // Arrange
        jest.spyOn(prisma.customer, 'findUnique').mockResolvedValue(mockCustomer);
        jest.spyOn(prisma.doctor, 'findUnique').mockResolvedValue(mockDoctor);

        const invalidInput = {
          ...validInput,
          scheduledAt: '2026-01-32T14:00:00+07:00', // Day 32 doesn't exist
        };

        // Act & Assert
        await expect(service.create(invalidInput)).rejects.toThrow(
          new GraphQLError('scheduledAt contains an invalid date', {
            extensions: { code: 'INVALID_INPUT' },
          })
        );
        expect(prisma.schedule.create).not.toHaveBeenCalled();
      });

      it('should accept valid leap year date (Feb 29, 2024)', async () => {
        // Arrange
        jest.spyOn(prisma.customer, 'findUnique').mockResolvedValue(mockCustomer);
        jest.spyOn(prisma.doctor, 'findUnique').mockResolvedValue(mockDoctor);
        jest.spyOn(prisma.schedule, 'create').mockResolvedValue(mockSchedule);

        const validLeapYearInput = {
          ...validInput,
          scheduledAt: '2024-02-29T14:00:00+07:00', // 2024 is a leap year
        };

        // Act
        await service.create(validLeapYearInput);

        // Assert
        expect(prisma.schedule.create).toHaveBeenCalled();
      });

      it('should throw INVALID_INPUT for Feb 29 in non-leap year', async () => {
        // Arrange
        jest.spyOn(prisma.customer, 'findUnique').mockResolvedValue(mockCustomer);
        jest.spyOn(prisma.doctor, 'findUnique').mockResolvedValue(mockDoctor);

        const invalidInput = {
          ...validInput,
          scheduledAt: '2026-02-29T14:00:00+07:00', // 2026 is not a leap year
        };

        // Act & Assert
        await expect(service.create(invalidInput)).rejects.toThrow(
          new GraphQLError('scheduledAt contains an invalid date', {
            extensions: { code: 'INVALID_INPUT' },
          })
        );
        expect(prisma.schedule.create).not.toHaveBeenCalled();
      });
    });

    describe('schedule conflict detection', () => {
      it('should throw CONFLICT when doctor has another schedule at the same time', async () => {
        // Arrange
        jest.spyOn(prisma.customer, 'findUnique').mockResolvedValue(mockCustomer);
        jest.spyOn(prisma.doctor, 'findUnique').mockResolvedValue(mockDoctor);
        
        const prismaError = new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed',
          {
            code: 'P2002',
            clientVersion: '5.0.0',
            meta: {
              target: ['doctorId', 'scheduledAt'],
            },
          }
        );
        
        jest.spyOn(prisma.schedule, 'create').mockRejectedValue(prismaError);

        // Act & Assert
        await expect(service.create(validInput)).rejects.toThrow(
          new GraphQLError('Doctor is not available at the requested time', {
            extensions: { code: 'CONFLICT' },
          })
        );
      });
    });

    describe('UTC conversion', () => {
      it('should convert positive timezone offset to UTC correctly', async () => {
        // Arrange
        jest.spyOn(prisma.customer, 'findUnique').mockResolvedValue(mockCustomer);
        jest.spyOn(prisma.doctor, 'findUnique').mockResolvedValue(mockDoctor);
        jest.spyOn(prisma.schedule, 'create').mockResolvedValue(mockSchedule);

        const input = {
          ...validInput,
          scheduledAt: '2026-10-15T14:00:00+07:00', // Jakarta time
        };

        // Act
        await service.create(input);

        // Assert
        expect(prisma.schedule.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              scheduledAt: '2026-10-15T07:00:00.000Z', // UTC time (14:00 - 7 hours)
            }),
          })
        );
      });

      it('should convert negative timezone offset to UTC correctly', async () => {
        // Arrange
        jest.spyOn(prisma.customer, 'findUnique').mockResolvedValue(mockCustomer);
        jest.spyOn(prisma.doctor, 'findUnique').mockResolvedValue(mockDoctor);
        jest.spyOn(prisma.schedule, 'create').mockResolvedValue(mockSchedule);

        const input = {
          ...validInput,
          scheduledAt: '2026-10-15T14:00:00-05:00', // EST time
        };

        // Act
        await service.create(input);

        // Assert
        expect(prisma.schedule.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              scheduledAt: '2026-10-15T19:00:00.000Z', // UTC time (14:00 + 5 hours)
            }),
          })
        );
      });

      it('should keep Z timezone as UTC without conversion', async () => {
        // Arrange
        jest.spyOn(prisma.customer, 'findUnique').mockResolvedValue(mockCustomer);
        jest.spyOn(prisma.doctor, 'findUnique').mockResolvedValue(mockDoctor);
        jest.spyOn(prisma.schedule, 'create').mockResolvedValue(mockSchedule);

        const input = {
          ...validInput,
          scheduledAt: '2026-10-15T14:00:00Z', // Already UTC
        };

        // Act
        await service.create(input);

        // Assert
        expect(prisma.schedule.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              scheduledAt: '2026-10-15T14:00:00.000Z', // Remains UTC
            }),
          })
        );
      });
    });
  });

  describe('findAll', () => {
    const mockSchedules = [
      {
        ...mockSchedule,
        id: 'schedule-uuid-1',
        scheduledAt: new Date('2026-10-15T07:00:00.000Z'),
      },
      {
        ...mockSchedule,
        id: 'schedule-uuid-2',
        scheduledAt: new Date('2026-10-16T08:00:00.000Z'),
      },
    ];

    it('should return paginated schedules with default pagination', async () => {
      // Arrange
      jest.spyOn(prisma.schedule, 'findMany').mockResolvedValue(mockSchedules);
      jest.spyOn(prisma.schedule, 'count').mockResolvedValue(2);

      const filters = {};

      // Act
      const result = await service.findAll(filters);

      // Assert
      expect(result.data).toEqual(mockSchedules);
      expect(result.pagination).toEqual({
        currentPage: 1,
        totalPages: 1,
        totalCount: 2,
        hasNextPage: false,
        hasPreviousPage: false,
      });
      expect(prisma.schedule.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        include: {
          customer: true,
          doctor: true,
        },
        orderBy: {
          scheduledAt: 'asc',
        },
      });
    });

    it('should apply pagination correctly', async () => {
      // Arrange
      jest.spyOn(prisma.schedule, 'findMany').mockResolvedValue([mockSchedule]);
      jest.spyOn(prisma.schedule, 'count').mockResolvedValue(25);

      const filters = { page: 3, limit: 5 };

      // Act
      const result = await service.findAll(filters);

      // Assert
      expect(result.pagination).toEqual({
        currentPage: 3,
        totalPages: 5,
        totalCount: 25,
        hasNextPage: true,
        hasPreviousPage: true,
      });
      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (page 3 - 1) * limit 5
          take: 5,
        })
      );
    });

    it('should filter by customerId', async () => {
      // Arrange
      jest.spyOn(prisma.schedule, 'findMany').mockResolvedValue([mockSchedule]);
      jest.spyOn(prisma.schedule, 'count').mockResolvedValue(1);

      const filters = { customerId: 'customer-uuid-1' };

      // Act
      await service.findAll(filters);

      // Assert
      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            customerId: 'customer-uuid-1',
          },
        })
      );
    });

    it('should filter by doctorId', async () => {
      // Arrange
      jest.spyOn(prisma.schedule, 'findMany').mockResolvedValue([mockSchedule]);
      jest.spyOn(prisma.schedule, 'count').mockResolvedValue(1);

      const filters = { doctorId: 'doctor-uuid-1' };

      // Act
      await service.findAll(filters);

      // Assert
      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            doctorId: 'doctor-uuid-1',
          },
        })
      );
    });

    it('should filter by date range (scheduledAtFrom and scheduledAtTo)', async () => {
      // Arrange
      jest.spyOn(prisma.schedule, 'findMany').mockResolvedValue([mockSchedule]);
      jest.spyOn(prisma.schedule, 'count').mockResolvedValue(1);

      const filters = {
        scheduledAtFrom: '2026-10-01T00:00:00+07:00',
        scheduledAtTo: '2026-10-31T23:59:59+07:00',
      };

      // Act
      await service.findAll(filters);

      // Assert
      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            scheduledAt: {
              gte: '2026-09-30T17:00:00.000Z', // Converted to UTC
              lte: '2026-10-31T16:59:59.000Z', // Converted to UTC
            },
          },
        })
      );
    });

    it('should filter by scheduledAtFrom only', async () => {
      // Arrange
      jest.spyOn(prisma.schedule, 'findMany').mockResolvedValue([mockSchedule]);
      jest.spyOn(prisma.schedule, 'count').mockResolvedValue(1);

      const filters = {
        scheduledAtFrom: '2026-10-01T00:00:00Z',
      };

      // Act
      await service.findAll(filters);

      // Assert
      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            scheduledAt: {
              gte: '2026-10-01T00:00:00.000Z',
            },
          },
        })
      );
    });

    it('should filter by scheduledAtTo only', async () => {
      // Arrange
      jest.spyOn(prisma.schedule, 'findMany').mockResolvedValue([mockSchedule]);
      jest.spyOn(prisma.schedule, 'count').mockResolvedValue(1);

      const filters = {
        scheduledAtTo: '2026-12-31T23:59:59Z',
      };

      // Act
      await service.findAll(filters);

      // Assert
      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            scheduledAt: {
              lte: '2026-12-31T23:59:59.000Z',
            },
          },
        })
      );
    });

    it('should combine multiple filters', async () => {
      // Arrange
      jest.spyOn(prisma.schedule, 'findMany').mockResolvedValue([mockSchedule]);
      jest.spyOn(prisma.schedule, 'count').mockResolvedValue(1);

      const filters = {
        customerId: 'customer-uuid-1',
        doctorId: 'doctor-uuid-1',
        scheduledAtFrom: '2026-10-01T00:00:00Z',
        scheduledAtTo: '2026-10-31T23:59:59Z',
        page: 2,
        limit: 5,
      };

      // Act
      await service.findAll(filters);

      // Assert
      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            customerId: 'customer-uuid-1',
            doctorId: 'doctor-uuid-1',
            scheduledAt: {
              gte: '2026-10-01T00:00:00.000Z',
              lte: '2026-10-31T23:59:59.000Z',
            },
          },
          skip: 5,
          take: 5,
        })
      );
    });

    it('should throw INVALID_INPUT when scheduledAtFrom is greater than scheduledAtTo', async () => {
      // Arrange
      const filters = {
        scheduledAtFrom: '2026-12-31T23:59:59Z',
        scheduledAtTo: '2026-01-01T00:00:00Z',
      };

      // Act & Assert
      await expect(service.findAll(filters)).rejects.toThrow(
        new GraphQLError('scheduledAtFrom cannot be greater than scheduledAtTo', {
          extensions: { code: 'INVALID_INPUT' },
        })
      );
      expect(prisma.schedule.findMany).not.toHaveBeenCalled();
    });

    it('should order schedules by scheduledAt ascending', async () => {
      // Arrange
      jest.spyOn(prisma.schedule, 'findMany').mockResolvedValue(mockSchedules);
      jest.spyOn(prisma.schedule, 'count').mockResolvedValue(2);

      // Act
      await service.findAll({});

      // Assert
      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            scheduledAt: 'asc',
          },
        })
      );
    });

    it('should include customer and doctor relations', async () => {
      // Arrange
      jest.spyOn(prisma.schedule, 'findMany').mockResolvedValue(mockSchedules);
      jest.spyOn(prisma.schedule, 'count').mockResolvedValue(2);

      // Act
      await service.findAll({});

      // Assert
      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            customer: true,
            doctor: true,
          },
        })
      );
    });
  });

  describe('findOne', () => {
    it('should return a schedule by ID with relations', async () => {
      // Arrange
      jest.spyOn(prisma.schedule, 'findUnique').mockResolvedValue(mockSchedule);

      // Act
      const result = await service.findOne('schedule-uuid-1');

      // Assert
      expect(result).toEqual(mockSchedule);
      expect(prisma.schedule.findUnique).toHaveBeenCalledWith({
        where: { id: 'schedule-uuid-1' },
        include: {
          customer: true,
          doctor: true,
        },
      });
    });

    it('should throw NOT_FOUND when schedule does not exist', async () => {
      // Arrange
      jest.spyOn(prisma.schedule, 'findUnique').mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        new GraphQLError('Schedule not found', {
          extensions: { code: 'NOT_FOUND' },
        })
      );
    });

    it('should include customer and doctor relations', async () => {
      // Arrange
      jest.spyOn(prisma.schedule, 'findUnique').mockResolvedValue(mockSchedule);

      // Act
      await service.findOne('schedule-uuid-1');

      // Assert
      expect(prisma.schedule.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            customer: true,
            doctor: true,
          },
        })
      );
    });
  });

  describe('delete', () => {
    it('should delete a schedule successfully', async () => {
      // Arrange
      jest.spyOn(prisma.schedule, 'findUnique').mockResolvedValue(mockSchedule);
      jest.spyOn(prisma.schedule, 'delete').mockResolvedValue(mockSchedule);

      // Act
      const result = await service.delete('schedule-uuid-1');

      // Assert
      expect(result).toBe(true);
      expect(prisma.schedule.findUnique).toHaveBeenCalledWith({
        where: { id: 'schedule-uuid-1' },
        include: {
          customer: true,
          doctor: true,
        },
      });
      expect(prisma.schedule.delete).toHaveBeenCalledWith({
        where: { id: 'schedule-uuid-1' },
      });
    });

    it('should throw NOT_FOUND when schedule does not exist', async () => {
      // Arrange
      jest.spyOn(prisma.schedule, 'findUnique').mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete('non-existent-id')).rejects.toThrow(
        new GraphQLError('Schedule not found', {
          extensions: { code: 'NOT_FOUND' },
        })
      );
      expect(prisma.schedule.delete).not.toHaveBeenCalled();
    });

    it('should retrieve complete schedule data including customer and doctor before deletion', async () => {
      // Arrange
      jest.spyOn(prisma.schedule, 'findUnique').mockResolvedValue(mockSchedule);
      jest.spyOn(prisma.schedule, 'delete').mockResolvedValue(mockSchedule);

      // Act
      await service.delete('schedule-uuid-1');

      // Assert
      expect(prisma.schedule.findUnique).toHaveBeenCalledWith({
        where: { id: 'schedule-uuid-1' },
        include: {
          customer: true,
          doctor: true,
        },
      });
      // Verify that the schedule data contains all required fields for email notification
      const findCall = (prisma.schedule.findUnique as jest.Mock).mock.calls[0];
      expect(findCall[0].include).toEqual({
        customer: true,
        doctor: true,
      });
    });
  });
});
