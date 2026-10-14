import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { GraphQLError } from 'graphql';
import * as bcrypt from 'bcrypt';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { validate } from 'class-validator';
import { RegisterInput } from './dto/register.input';

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const validRegisterInput = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      password: '$2b$10$hashedpassword',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    };

    it('should successfully register a new user', async () => {
      // Arrange
      const hashedPassword = '$2b$10$hashedpassword';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      // Act
      const result = await service.register(validRegisterInput);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          password: hashedPassword,
        },
      });
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('should hash password with saltRounds=10', async () => {
      // Arrange
      const hashedPassword = '$2b$10$hashedpassword';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      // Act
      await service.register(validRegisterInput);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });

    it('should throw CONFLICT error when email already exists', async () => {
      // Arrange
      const hashedPassword = '$2b$10$hashedpassword';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const prismaError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
          meta: { target: ['email'] },
        }
      );
      mockPrismaService.user.create.mockRejectedValue(prismaError);

      // Act & Assert
      await expect(service.register(validRegisterInput)).rejects.toThrow(GraphQLError);
      
      try {
        await service.register(validRegisterInput);
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect(error.message).toBe('Email already exists');
        expect(error.extensions.code).toBe('CONFLICT');
      }
    });

    it('should return user without password field', async () => {
      // Arrange
      const hashedPassword = '$2b$10$hashedpassword';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      // Act
      const result = await service.register(validRegisterInput);

      // Assert
      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });

    it('should rethrow unexpected errors', async () => {
      // Arrange
      const hashedPassword = '$2b$10$hashedpassword';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      
      const unexpectedError = new Error('Database connection failed');
      mockPrismaService.user.create.mockRejectedValue(unexpectedError);

      // Act & Assert
      await expect(service.register(validRegisterInput)).rejects.toThrow('Database connection failed');
    });
  });

  describe('register - DTO validation', () => {
    /**
     * Tests for RegisterInput validation using class-validator.
     * These tests verify that email and password validation rules are enforced.     */

    it('should validate and reject invalid email format', async () => {
      // Arrange
      const invalidEmailInput = new RegisterInput();
      invalidEmailInput.email = 'invalid-email';
      invalidEmailInput.password = 'password123';

      // Act
      const errors = await validate(invalidEmailInput);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      const emailError = errors.find(e => e.property === 'email');
      expect(emailError).toBeDefined();
      expect(emailError?.constraints).toHaveProperty('isEmail');
    });

    it('should validate and reject password shorter than 8 characters', async () => {
      // Arrange
      const weakPasswordInput = new RegisterInput();
      weakPasswordInput.email = 'test@example.com';
      weakPasswordInput.password = 'pass1'; // Only 5 characters

      // Act
      const errors = await validate(weakPasswordInput);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      const passwordError = errors.find(e => e.property === 'password');
      expect(passwordError).toBeDefined();
      expect(passwordError?.constraints).toHaveProperty('minLength');
    });

    it('should validate and reject password without letters', async () => {
      // Arrange
      const noLettersPasswordInput = new RegisterInput();
      noLettersPasswordInput.email = 'test@example.com';
      noLettersPasswordInput.password = '12345678'; // Only numbers

      // Act
      const errors = await validate(noLettersPasswordInput);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      const passwordError = errors.find(e => e.property === 'password');
      expect(passwordError).toBeDefined();
      expect(passwordError?.constraints).toHaveProperty('matches');
      expect(passwordError?.constraints?.matches).toContain('at least one letter and one number');
    });

    it('should validate and reject password without numbers', async () => {
      // Arrange
      const noNumbersPasswordInput = new RegisterInput();
      noNumbersPasswordInput.email = 'test@example.com';
      noNumbersPasswordInput.password = 'passwordonly'; // Only letters

      // Act
      const errors = await validate(noNumbersPasswordInput);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      const passwordError = errors.find(e => e.property === 'password');
      expect(passwordError).toBeDefined();
      expect(passwordError?.constraints).toHaveProperty('matches');
      expect(passwordError?.constraints?.matches).toContain('at least one letter and one number');
    });

    it('should validate and accept valid email and password', async () => {
      // Arrange
      const validInput = new RegisterInput();
      validInput.email = 'valid@example.com';
      validInput.password = 'password123';

      // Act
      const errors = await validate(validInput);

      // Assert
      expect(errors.length).toBe(0);
    });
  });

  describe('login', () => {
    const validLoginInput = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      password: '$2b$10$hashedpassword',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    };

    it('should successfully login and return token and expiry', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      // Act
      const result = await service.login(validLoginInput);

      // Assert
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', '$2b$10$hashedpassword');
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        {
          userId: mockUser.id,
          email: mockUser.email,
        },
        { expiresIn: 3600 }
      );
      expect(result).toHaveProperty('accessToken', 'mock-jwt-token');
      expect(result).toHaveProperty('expiresAt');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should throw UNAUTHENTICATED error when user not found', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(validLoginInput)).rejects.toThrow(GraphQLError);

      try {
        await service.login(validLoginInput);
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect(error.message).toBe('Invalid email or password');
        expect(error.extensions.code).toBe('UNAUTHENTICATED');
      }
    });

    it('should throw UNAUTHENTICATED error when password is invalid', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(service.login(validLoginInput)).rejects.toThrow(GraphQLError);

      try {
        await service.login(validLoginInput);
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect(error.message).toBe('Invalid email or password');
        expect(error.extensions.code).toBe('UNAUTHENTICATED');
      }
    });

    it('should generate token with correct payload containing userId and email', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      // Act
      await service.login(validLoginInput);

      // Assert
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        {
          userId: mockUser.id,
          email: mockUser.email,
        },
        { expiresIn: 3600 }
      );
    });
  });

  describe('validateToken', () => {
    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      password: '$2b$10$hashedpassword',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    };

    const mockTokenPayload = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    it('should return user information for valid token', async () => {
      // Arrange
      mockJwtService.verify.mockReturnValue(mockTokenPayload);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.validateToken('valid-jwt-token');

      // Assert
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-jwt-token');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockTokenPayload.userId },
      });
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('should throw UNAUTHENTICATED error with "Token has expired" message for expired token', async () => {
      // Arrange
      const tokenExpiredError = new Error('jwt expired');
      tokenExpiredError.name = 'TokenExpiredError';
      mockJwtService.verify.mockImplementation(() => {
        throw tokenExpiredError;
      });

      // Act & Assert
      await expect(service.validateToken('expired-jwt-token')).rejects.toThrow(GraphQLError);

      try {
        await service.validateToken('expired-jwt-token');
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect(error.message).toBe('Token has expired');
        expect(error.extensions.code).toBe('UNAUTHENTICATED');
      }
    });

    it('should throw UNAUTHENTICATED error with "Invalid token" message for invalid token', async () => {
      // Arrange
      const jsonWebTokenError = new Error('invalid signature');
      jsonWebTokenError.name = 'JsonWebTokenError';
      mockJwtService.verify.mockImplementation(() => {
        throw jsonWebTokenError;
      });

      // Act & Assert
      await expect(service.validateToken('invalid-jwt-token')).rejects.toThrow(GraphQLError);

      try {
        await service.validateToken('invalid-jwt-token');
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect(error.message).toBe('Invalid token');
        expect(error.extensions.code).toBe('UNAUTHENTICATED');
      }
    });

    it('should throw UNAUTHENTICATED error when user not found', async () => {
      // Arrange
      mockJwtService.verify.mockReturnValue(mockTokenPayload);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.validateToken('valid-jwt-token')).rejects.toThrow(GraphQLError);

      try {
        await service.validateToken('valid-jwt-token');
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect(error.message).toBe('Invalid token');
        expect(error.extensions.code).toBe('UNAUTHENTICATED');
      }
    });

    it('should return user without password field', async () => {
      // Arrange
      mockJwtService.verify.mockReturnValue(mockTokenPayload);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.validateToken('valid-jwt-token');

      // Assert
      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });
  });
});
