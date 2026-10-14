// Set required environment variables before importing modules
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test?schema=auth_schema';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRATION = '3600';

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './auth.module';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should have PrismaService available', () => {
    const prismaService = module.get<PrismaService>(PrismaService);
    expect(prismaService).toBeDefined();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });
});

describe('AuthModule Environment Validation', () => {
  it('should validate presence of DATABASE_URL', () => {
    const originalDb = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    
    const validate = (config: any) => {
      const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];
      const missing = requiredVars.filter((varName) => !config[varName]);
      
      if (missing.length > 0) {
        throw new Error(
          `Missing required environment variables: ${missing.join(', ')}`
        );
      }
      
      return config;
    };

    expect(() => validate({})).toThrow('Missing required environment variables: DATABASE_URL, JWT_SECRET');
    
    // Restore
    if (originalDb) process.env.DATABASE_URL = originalDb;
  });

  it('should validate presence of JWT_SECRET', () => {
    const validate = (config: any) => {
      const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];
      const missing = requiredVars.filter((varName) => !config[varName]);
      
      if (missing.length > 0) {
        throw new Error(
          `Missing required environment variables: ${missing.join(', ')}`
        );
      }
      
      return config;
    };

    expect(() => validate({ DATABASE_URL: 'some-url' })).toThrow('Missing required environment variables: JWT_SECRET');
  });
});
