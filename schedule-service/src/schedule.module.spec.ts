import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from './schedule.module';
import { PrismaService } from './prisma/prisma.service';
import { BullModule } from '@nestjs/bull';

// Mock @nestjs/axios to avoid ESM import issues
jest.mock('@nestjs/axios', () => ({
  HttpModule: {
    registerAsync: jest.fn().mockReturnValue({
      module: class MockHttpModule {},
      providers: [],
      exports: [],
    }),
  },
}));

// Mock @nestjs/bull to avoid ESM import issues
jest.mock('@nestjs/bull', () => ({
  BullModule: {
    forRootAsync: jest.fn().mockReturnValue({
      module: class MockBullRootModule {},
      providers: [],
      exports: [],
    }),
    registerQueue: jest.fn().mockReturnValue({
      module: class MockBullQueueModule {},
      providers: [],
      exports: [],
    }),
  },
}));

describe('ScheduleModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    // Set test environment variables
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test?schema=schedule_schema';
    process.env.AUTH_SERVICE_URL = 'http://localhost:3001';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';

    module = await Test.createTestingModule({
      imports: [ScheduleModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      })
      .compile();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should have PrismaService', () => {
    const prismaService = module.get<PrismaService>(PrismaService);
    expect(prismaService).toBeDefined();
  });
});
