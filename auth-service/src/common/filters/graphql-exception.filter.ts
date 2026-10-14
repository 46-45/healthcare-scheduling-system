import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import {
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

/**
 * Global exception filter for GraphQL operations
 * Maps Prisma errors and NestJS exceptions to GraphQL error codes
 */
@Catch()
export class GraphQLExceptionFilter implements GqlExceptionFilter {
  private readonly logger = new Logger(GraphQLExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    // Handle Prisma database errors
    if (exception instanceof PrismaClientKnownRequestError) {
      // P2002: Unique constraint violation
      if (exception.code === 'P2002') {
        const field = exception.meta?.target?.[0] || 'field';
        return new GraphQLError(`${field} already exists`, {
          extensions: { code: 'CONFLICT' },
        });
      }

      // P2003: Foreign key constraint violation
      if (exception.code === 'P2003') {
        return new GraphQLError(
          'Cannot delete resource with existing dependencies',
          {
            extensions: { code: 'CONSTRAINT_VIOLATION' },
          },
        );
      }

      // P2025: Record not found
      if (exception.code === 'P2025') {
        return new GraphQLError('Resource not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
    }

    // Handle NestJS built-in exceptions
    if (exception instanceof UnauthorizedException) {
      return new GraphQLError(exception.message, {
        extensions: {
          code: 'UNAUTHENTICATED',
          http: { status: 401 },
        },
      });
    }

    if (exception instanceof NotFoundException) {
      return new GraphQLError(exception.message, {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    if (exception instanceof BadRequestException) {
      return new GraphQLError(exception.message, {
        extensions: { code: 'INVALID_INPUT' },
      });
    }

    // Handle GraphQL errors (pass through)
    if (exception instanceof GraphQLError) {
      return exception;
    }

    // Handle unexpected errors
    this.logger.error('Unexpected error occurred', exception);

    return new GraphQLError('Internal server error', {
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
  }
}
