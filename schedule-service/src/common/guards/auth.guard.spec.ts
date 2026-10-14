import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { of, throwError } from 'rxjs';
import { AuthGuard } from './auth.guard';
import { HttpService } from '@nestjs/axios';
import { CacheService } from '../../cache/cache.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let mockHttpService: any;
  let mockConfigService: any;
  let mockCacheService: any;

  beforeEach(async () => {
    mockHttpService = {
      post: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('http://localhost:3001'),
    };

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should return UNAUTHENTICATED error if Authorization header is missing', async () => {
      const mockRequest = { headers: {}, user: undefined };
      
      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => ({ req: mockRequest }),
      } as any);

      mockCacheService.get.mockResolvedValue(null); // Cache miss

      await expect(guard.canActivate({} as ExecutionContext)).rejects.toThrow(GraphQLError);
      await expect(guard.canActivate({} as ExecutionContext)).rejects.toMatchObject({
        message: 'Authorization token required',
        extensions: { code: 'UNAUTHENTICATED' },
      });
    });

    it('should return UNAUTHENTICATED error if Authorization header is malformed', async () => {
      const mockRequest = { headers: { authorization: 'InvalidFormat token123' }, user: undefined };
      
      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => ({ req: mockRequest }),
      } as any);

      mockCacheService.get.mockResolvedValue(null); // Cache miss

      await expect(guard.canActivate({} as ExecutionContext)).rejects.toThrow(GraphQLError);
      await expect(guard.canActivate({} as ExecutionContext)).rejects.toMatchObject({
        message: 'Authorization token required',
        extensions: { code: 'UNAUTHENTICATED' },
      });
    });

    it('should return true and attach user to request when token is valid', async () => {
      const mockRequest = { headers: { authorization: 'Bearer validtoken123' }, user: undefined };
      
      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => ({ req: mockRequest }),
      } as any);

      mockCacheService.get.mockResolvedValue(null); // Cache miss

      const mockResponse: any = {
        data: {
          data: {
            validateToken: {
              id: 'user-123',
              email: 'test@example.com',
            },
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await guard.canActivate({} as ExecutionContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
      });
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://localhost:3001/graphql',
        expect.objectContaining({
          query: expect.stringContaining('validateToken'),
          variables: { token: 'validtoken123' },
        }),
        { timeout: 5000 },
      );
      // Verify cache.set was called to cache the result
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringMatching(/^auth:token:[a-f0-9]{32}$/),
        { id: 'user-123', email: 'test@example.com' },
        300,
      );
    });

    it('should return UNAUTHENTICATED error if Auth Service returns errors', async () => {
      const mockRequest = { headers: { authorization: 'Bearer invalidtoken' }, user: undefined };
      
      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => ({ req: mockRequest }),
      } as any);

      mockCacheService.get.mockResolvedValue(null); // Cache miss

      const mockResponse: any = {
        data: {
          errors: [{ message: 'Token has expired' }],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      await expect(guard.canActivate({} as ExecutionContext)).rejects.toThrow(GraphQLError);
      await expect(guard.canActivate({} as ExecutionContext)).rejects.toMatchObject({
        message: 'Invalid or expired token',
        extensions: { code: 'UNAUTHENTICATED' },
      });
    });

    it('should return UNAVAILABLE error on ECONNREFUSED', async () => {
      const mockRequest = { headers: { authorization: 'Bearer token123' }, user: undefined };
      
      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => ({ req: mockRequest }),
      } as any);

      mockCacheService.get.mockResolvedValue(null); // Cache miss

      const error = new Error('Connection refused') as any;
      error.code = 'ECONNREFUSED';

      mockHttpService.post.mockReturnValue(throwError(() => error));

      await expect(guard.canActivate({} as ExecutionContext)).rejects.toThrow(GraphQLError);
      await expect(guard.canActivate({} as ExecutionContext)).rejects.toMatchObject({
        message: 'Authentication service unavailable',
        extensions: { code: 'UNAVAILABLE' },
      });
    });

    it('should return UNAVAILABLE error on ETIMEDOUT', async () => {
      const mockRequest = { headers: { authorization: 'Bearer token123' }, user: undefined };
      
      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => ({ req: mockRequest }),
      } as any);

      mockCacheService.get.mockResolvedValue(null); // Cache miss

      const error = new Error('Timeout') as any;
      error.code = 'ETIMEDOUT';

      mockHttpService.post.mockReturnValue(throwError(() => error));

      await expect(guard.canActivate({} as ExecutionContext)).rejects.toThrow(GraphQLError);
      await expect(guard.canActivate({} as ExecutionContext)).rejects.toMatchObject({
        message: 'Authentication service unavailable',
        extensions: { code: 'UNAVAILABLE' },
      });
    });

    it('should set timeout to 5000ms for Auth Service request', async () => {
      const mockRequest = { headers: { authorization: 'Bearer token123' }, user: undefined };
      
      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => ({ req: mockRequest }),
      } as any);

      mockCacheService.get.mockResolvedValue(null); // Cache miss

      const mockResponse: any = {
        data: {
          data: {
            validateToken: {
              id: 'user-123',
              email: 'test@example.com',
            },
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      await guard.canActivate({} as ExecutionContext);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        { timeout: 5000 },
      );
    });

    it('should return UNAUTHENTICATED if validateToken returns null', async () => {
      const mockRequest = { headers: { authorization: 'Bearer token123' }, user: undefined };
      
      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => ({ req: mockRequest }),
      } as any);

      mockCacheService.get.mockResolvedValue(null); // Cache miss

      const mockResponse: any = {
        data: {
          data: {
            validateToken: null,
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      await expect(guard.canActivate({} as ExecutionContext)).rejects.toThrow(GraphQLError);
      await expect(guard.canActivate({} as ExecutionContext)).rejects.toMatchObject({
        message: 'Invalid or expired token',
        extensions: { code: 'UNAUTHENTICATED' },
      });
    });

    // Caching behavior tests (Requirements 11.5, 11.6, 11.8, 11.12)
    it('should return cached user when cache hit occurs', async () => {
      const mockRequest = { headers: { authorization: 'Bearer cachedtoken123' }, user: undefined };
      
      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => ({ req: mockRequest }),
      } as any);

      const cachedUser = { id: 'cached-user-123', email: 'cached@example.com' };
      mockCacheService.get.mockResolvedValue(cachedUser); // Cache hit

      const result = await guard.canActivate({} as ExecutionContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual(cachedUser);
      // Auth Service should NOT be called on cache hit
      expect(mockHttpService.post).not.toHaveBeenCalled();
      // Cache.set should NOT be called on cache hit
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    it('should compute SHA256 hash and use first 32 chars as cache key', async () => {
      const mockRequest = { headers: { authorization: 'Bearer testtoken456' }, user: undefined };
      
      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => ({ req: mockRequest }),
      } as any);

      mockCacheService.get.mockResolvedValue(null); // Cache miss

      const mockResponse: any = {
        data: {
          data: {
            validateToken: {
              id: 'user-456',
              email: 'test456@example.com',
            },
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      await guard.canActivate({} as ExecutionContext);

      // Verify cache.get was called with correct key format: auth:token:{first32charsOfSHA256}
      expect(mockCacheService.get).toHaveBeenCalledWith(
        expect.stringMatching(/^auth:token:[a-f0-9]{32}$/)
      );
    });

    it('should cache token validation result with 300 second TTL', async () => {
      const mockRequest = { headers: { authorization: 'Bearer newtoken789' }, user: undefined };
      
      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => ({ req: mockRequest }),
      } as any);

      mockCacheService.get.mockResolvedValue(null); // Cache miss

      const mockResponse: any = {
        data: {
          data: {
            validateToken: {
              id: 'user-789',
              email: 'test789@example.com',
            },
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      await guard.canActivate({} as ExecutionContext);

      // Verify cache.set was called with 300 second TTL
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringMatching(/^auth:token:[a-f0-9]{32}$/),
        { id: 'user-789', email: 'test789@example.com' },
        300
      );
    });

    it('should continue successfully if cache.set fails (graceful degradation)', async () => {
      const mockRequest = { headers: { authorization: 'Bearer token999' }, user: undefined };
      
      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => ({ req: mockRequest }),
      } as any);

      mockCacheService.get.mockResolvedValue(null); // Cache miss
      mockCacheService.set.mockRejectedValue(new Error('Redis connection failed')); // Cache write error

      const mockResponse: any = {
        data: {
          data: {
            validateToken: {
              id: 'user-999',
              email: 'test999@example.com',
            },
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      // Should not throw despite cache error
      const result = await guard.canActivate({} as ExecutionContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual({
        id: 'user-999',
        email: 'test999@example.com',
      });
    });

    it('should not cache validation results on Auth Service errors', async () => {
      const mockRequest = { headers: { authorization: 'Bearer badtoken' }, user: undefined };
      
      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => ({ req: mockRequest }),
      } as any);

      mockCacheService.get.mockResolvedValue(null); // Cache miss

      const mockResponse: any = {
        data: {
          errors: [{ message: 'Invalid token' }],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      await expect(guard.canActivate({} as ExecutionContext)).rejects.toThrow(GraphQLError);

      // Cache.set should NOT be called for failed validations
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });
  });
});