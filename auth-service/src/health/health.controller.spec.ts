import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return ok status when database is connected', async () => {
      jest.spyOn(prismaService, '$queryRaw').mockResolvedValue([]);

      const result = await controller.check();

      expect(result).toMatchObject({
        status: 'ok',
        service: 'auth-service',
        database: 'connected',
      });
      expect(result.timestamp).toBeDefined();
    });

    it('should return error status when database connection fails', async () => {
      const error = new Error('Database connection failed');
      jest.spyOn(prismaService, '$queryRaw').mockRejectedValue(error);

      const result = await controller.check();

      expect(result).toMatchObject({
        status: 'error',
        service: 'auth-service',
        database: 'disconnected',
        error: 'Database connection failed',
      });
      expect(result.timestamp).toBeDefined();
    });
  });
});
