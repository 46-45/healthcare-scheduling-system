import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { createHash } from 'crypto';
import { CacheService } from '../../cache/cache.service';

/**
 * AuthGuard validates JWT tokens by communicating with the Auth Service */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private readonly authServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.authServiceUrl = this.configService.get<string>('AUTH_SERVICE_URL');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new GraphQLError('Authorization token required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Extract JWT token from Bearer format
    const token = authHeader.substring(7);

    // Compute SHA256 hash of token (use first 32 chars as key)
    const tokenHash = createHash('sha256').update(token).digest('hex').substring(0, 32);
    const cacheKey = `auth:token:${tokenHash}`;

    try {
      // Check cache before calling Auth Service
      const cachedUser = await this.cacheService.get<{ id: string; email: string }>(cacheKey);
      if (cachedUser) {
        this.logger.debug(`Cache hit for token hash: ${tokenHash}`);
        req.user = cachedUser;
        return true;
      }

      // Cache miss - proceed to validate with Auth Service
      this.logger.debug(`Cache miss for token hash: ${tokenHash}, validating with Auth Service`);

      // Make HTTP POST request to Auth Service validateToken query
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.authServiceUrl}/graphql`,
          {
            query: `
              query ValidateToken($token: String!) {
                validateToken(token: $token) {
                  id
                  email
                }
              }
            `,
            variables: { token },
          },
          {
            timeout: 5000, // Set timeout to 5000ms
          },
        ),
      );

      // Handle Auth Service errors
      if (response.data.errors) {
        this.logger.warn('Auth Service returned errors', response.data.errors);
        throw new GraphQLError('Invalid or expired token', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Extract user information from Auth Service response
      const user = response.data.data?.validateToken;
      if (!user) {
        throw new GraphQLError('Invalid or expired token', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Attach user info to request context
      req.user = user;

      // Cache successful validation result with TTL
      // TTL should be min(300 seconds, remaining token expiry)
      // Since we don't decode JWT here, we use 300 seconds (5 minutes) as default
      // In production, you could decode the JWT to get actual expiry
      try {
        await this.cacheService.set(cacheKey, user, 300); // 300 seconds TTL
        this.logger.debug(`Cached user for token hash: ${tokenHash} with TTL 300 seconds`);
      } catch (cacheError) {
        // Graceful degradation - cache errors don't fail the request
        this.logger.error(`Failed to cache token validation result: ${cacheError.message}`);
      }

      return true;
    } catch (error) {
      // Handle network errors (ECONNREFUSED, ETIMEDOUT)
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        this.logger.error('Auth Service unavailable', error);
        throw new GraphQLError('Authentication service unavailable', {
          extensions: { code: 'UNAVAILABLE' },
        });
      }

      // Re-throw GraphQL errors
      if (error instanceof GraphQLError) {
        throw error;
      }

      // Log unexpected errors
      this.logger.error('Unexpected error during authentication', error);
      throw new GraphQLError('Authentication service unavailable', {
        extensions: { code: 'UNAVAILABLE' },
      });
    }
  }
}
