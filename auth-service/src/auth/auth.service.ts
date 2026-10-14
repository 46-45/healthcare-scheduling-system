import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { GraphQLError } from 'graphql';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginInput } from './dto/login.input';
import { RegisterInput } from './dto/register.input';
import { LoginResponse } from './entities/login-response.entity';
import { User } from './entities/user.entity';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

/**
 * Authentication service handling user registration, login, and token validation.
 * Implements JWT-based authentication with bcrypt password hashing.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a new user with email and password.
   *   * - 1.1: Create user record with valid email and password
   * - 1.2: Hash password using bcrypt with salt rounds of 10
   * - 1.3: Return CONFLICT error if email already exists
   * - 1.7: Return user info excluding password hash
   * - 20.2: Map Prisma P2002 to GraphQL CONFLICT error
   * 
   * @param registerInput - Contains email and password (validated by class-validator)
   * @returns User object excluding password field
   * @throws GraphQLError with code CONFLICT if email already exists
   */
  async register(registerInput: RegisterInput): Promise<User> {
    const { email, password } = registerInput;

    try {
      // Hash password with bcrypt using saltRounds=10
      const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

      // Create user record
      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
        },
      });

      this.logger.log(`User registered successfully: ${email}`);

      // Return user excluding password field
      return {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      // Map Prisma P2002 (unique constraint violation) to GraphQL CONFLICT error
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.warn(`Registration failed: Email already exists - ${email}`);
        throw new GraphQLError('Email already exists', {
          extensions: { code: 'CONFLICT' },
        });
      }

      // Re-throw unexpected errors
      this.logger.error(`Registration failed for ${email}`, error);
      throw error;
    }
  }

  /**
   * Authenticate user with email and password credentials.
   * Generates JWT token with 1-hour expiry on successful authentication.
   * 
   * @param loginInput - User credentials (email and password)
   * @returns LoginResponse containing accessToken and expiresAt
   * @throws GraphQLError with code UNAUTHENTICATED if credentials are invalid
   *   */
  async login(loginInput: LoginInput): Promise<LoginResponse> {
    const { email, password } = loginInput;

    // Query user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Return UNAUTHENTICATED if user not found
    if (!user) {
      this.logger.warn(`Login attempt failed: user not found for email ${email}`);
      throw new GraphQLError('Invalid email or password', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Compare password with bcrypt (constant-time comparison)
    const isPasswordValid = await bcrypt.compare(password, user.password);

    // Return UNAUTHENTICATED if password mismatch
    if (!isPasswordValid) {
      this.logger.warn(`Login attempt failed: invalid password for email ${email}`);
      throw new GraphQLError('Invalid email or password', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Generate JWT token with payload { userId, email, iat, exp }
    const payload = {
      userId: user.id,
      email: user.email,
    };

    // Token expiry: 3600 seconds (1 hour)
    const expirySeconds = 3600;
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: expirySeconds,
    });

    // Calculate expiresAt timestamp (ISO 8601 format)
    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    this.logger.log(`User ${email} logged in successfully`);

    return {
      accessToken,
      expiresAt,
    };
  }

  /**
   * Validate JWT token and return user information.
   * Used by Schedule Service to authenticate incoming requests.
   * 
   * @param token - JWT access token to validate
   * @returns User object excluding password
   * @throws GraphQLError with code UNAUTHENTICATED if token is expired or invalid
   *   */
  async validateToken(token: string): Promise<User> {
    try {
      // Verify token signature and expiry using JwtService
      const payload = this.jwtService.verify(token);

      // Extract userId from token payload
      const userId = payload.userId;

      // Query user by ID
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      // Return UNAUTHENTICATED if user not found (token references non-existent user)
      if (!user) {
        this.logger.warn(`Token validation failed: user not found for userId ${userId}`);
        throw new GraphQLError('Invalid token', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      this.logger.log(`Token validated successfully for user ${user.email}`);

      // Return user object excluding password
      return {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      // Handle specific JWT errors
      if (error.name === 'TokenExpiredError') {
        this.logger.warn('Token validation failed: token has expired');
        throw new GraphQLError('Token has expired', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Handle other JWT verification errors (JsonWebTokenError, NotBeforeError, etc.)
      if (error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError') {
        this.logger.warn(`Token validation failed: ${error.message}`);
        throw new GraphQLError('Invalid token', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Re-throw GraphQLError if already thrown (user not found case)
      if (error instanceof GraphQLError) {
        throw error;
      }

      // Handle unexpected errors
      this.logger.error(`Unexpected error during token validation: ${error.message}`, error.stack);
      throw new GraphQLError('Invalid token', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }
  }
}
