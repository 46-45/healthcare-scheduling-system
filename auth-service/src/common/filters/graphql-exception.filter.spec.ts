import { ArgumentsHost } from '@nestjs/common';
import {
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { GraphQLExceptionFilter } from './graphql-exception.filter';

describe('GraphQLExceptionFilter', () => {
  let filter: GraphQLExceptionFilter;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GraphQLExceptionFilter();
    mockHost = {} as ArgumentsHost;
  });

  describe('Prisma error mapping', () => {
    it('should map P2002 to CONFLICT error', () => {
      const prismaError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
          meta: { target: ['email'] },
        },
      );

      const result = filter.catch(prismaError, mockHost) as GraphQLError;

      expect(result).toBeInstanceOf(GraphQLError);
      expect(result.message).toBe('email already exists');
      expect(result.extensions?.code).toBe('CONFLICT');
    });

    it('should map P2003 to CONSTRAINT_VIOLATION error', () => {
      const prismaError = new PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        {
          code: 'P2003',
          clientVersion: '5.0.0',
        },
      );

      const result = filter.catch(prismaError, mockHost) as GraphQLError;

      expect(result).toBeInstanceOf(GraphQLError);
      expect(result.message).toBe(
        'Cannot delete resource with existing dependencies',
      );
      expect(result.extensions?.code).toBe('CONSTRAINT_VIOLATION');
    });

    it('should map P2025 to NOT_FOUND error', () => {
      const prismaError = new PrismaClientKnownRequestError(
        'Record not found',
        {
          code: 'P2025',
          clientVersion: '5.0.0',
        },
      );

      const result = filter.catch(prismaError, mockHost) as GraphQLError;

      expect(result).toBeInstanceOf(GraphQLError);
      expect(result.message).toBe('Resource not found');
      expect(result.extensions?.code).toBe('NOT_FOUND');
    });
  });

  describe('NestJS exception mapping', () => {
    it('should map UnauthorizedException to UNAUTHENTICATED', () => {
      const exception = new UnauthorizedException('Invalid credentials');

      const result = filter.catch(exception, mockHost) as GraphQLError;

      expect(result).toBeInstanceOf(GraphQLError);
      expect(result.message).toBe('Invalid credentials');
      expect(result.extensions?.code).toBe('UNAUTHENTICATED');
      expect(result.extensions?.http).toEqual({ status: 401 });
    });

    it('should map NotFoundException to NOT_FOUND', () => {
      const exception = new NotFoundException('User not found');

      const result = filter.catch(exception, mockHost) as GraphQLError;

      expect(result).toBeInstanceOf(GraphQLError);
      expect(result.message).toBe('User not found');
      expect(result.extensions?.code).toBe('NOT_FOUND');
    });

    it('should map BadRequestException to INVALID_INPUT', () => {
      const exception = new BadRequestException('Invalid email format');

      const result = filter.catch(exception, mockHost) as GraphQLError;

      expect(result).toBeInstanceOf(GraphQLError);
      expect(result.message).toBe('Invalid email format');
      expect(result.extensions?.code).toBe('INVALID_INPUT');
    });
  });

  describe('GraphQL error pass-through', () => {
    it('should pass through existing GraphQL errors', () => {
      const graphqlError = new GraphQLError('Custom error', {
        extensions: { code: 'CUSTOM_CODE' },
      });

      const result = filter.catch(graphqlError, mockHost) as GraphQLError;

      expect(result).toBe(graphqlError);
      expect(result.message).toBe('Custom error');
      expect(result.extensions?.code).toBe('CUSTOM_CODE');
    });
  });

  describe('Unexpected errors', () => {
    it('should map unexpected errors to INTERNAL_SERVER_ERROR', () => {
      const error = new Error('Unexpected error');

      const result = filter.catch(error, mockHost) as GraphQLError;

      expect(result).toBeInstanceOf(GraphQLError);
      expect(result.message).toBe('Internal server error');
      expect(result.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should handle unknown error types', () => {
      const error = 'String error';

      const result = filter.catch(error, mockHost) as GraphQLError;

      expect(result).toBeInstanceOf(GraphQLError);
      expect(result.message).toBe('Internal server error');
      expect(result.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });
});
