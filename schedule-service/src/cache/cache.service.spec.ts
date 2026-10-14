import { Test, TestingModule } from '@nestjs/testing';
import { CacheService, CACHE_MANAGER } from './cache.service';
import { Logger } from '@nestjs/common';

describe('CacheService', () => {
  let service: CacheService;
  let mockCacheManager: any;
  let mockRedisClient: any;

  beforeEach(async () => {
    mockRedisClient = {
      scan: jest.fn(),
      del: jest.fn(),
    };

    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      store: {
        client: mockRedisClient,
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('get', () => {
    it('should return cached value when key exists', async () => {
      const testValue = { data: 'test' };
      mockCacheManager.get.mockResolvedValue(testValue);

      const result = await service.get('test-key');

      expect(result).toEqual(testValue);
      expect(mockCacheManager.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null when key does not exist', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      const result = await service.get('missing-key');

      expect(result).toBeNull();
    });

    it('should return null and log error on cache read failure', async () => {
      const error = new Error('Redis connection failed');
      mockCacheManager.get.mockRejectedValue(error);

      const result = await service.get('test-key');

      expect(result).toBeNull();
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Cache read error for key test-key'),
        expect.any(String),
      );
    });
  });

  describe('set', () => {
    it('should set value with default TTL (300 seconds)', async () => {
      await service.set('test-key', { data: 'test' });

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'test-key',
        { data: 'test' },
        300000, // 300 seconds * 1000 = milliseconds
      );
    });

    it('should set value with custom TTL', async () => {
      await service.set('test-key', { data: 'test' }, 600);

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'test-key',
        { data: 'test' },
        600000, // 600 seconds * 1000
      );
    });

    it('should log error but not throw on cache write failure', async () => {
      const error = new Error('Redis connection failed');
      mockCacheManager.set.mockRejectedValue(error);

      await expect(service.set('test-key', { data: 'test' })).resolves.not.toThrow();

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Cache write error for key test-key'),
        expect.any(String),
      );
    });
  });

  describe('del', () => {
    it('should delete key from cache', async () => {
      await service.del('test-key');

      expect(mockCacheManager.del).toHaveBeenCalledWith('test-key');
    });

    it('should log error but not throw on cache deletion failure', async () => {
      const error = new Error('Redis connection failed');
      mockCacheManager.del.mockRejectedValue(error);

      await expect(service.del('test-key')).resolves.not.toThrow();

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Cache deletion error for key test-key'),
        expect.any(String),
      );
    });
  });

  describe('invalidatePattern', () => {
    it('should invalidate all keys matching pattern', async () => {
      // Mock SCAN returning keys in multiple iterations with object-based API
      mockRedisClient.scan
        .mockResolvedValueOnce({
          cursor: 1,
          keys: ['customers:list:page:1:limit:10', 'customers:list:page:2:limit:10']
        })
        .mockResolvedValueOnce({
          cursor: 0,
          keys: ['customers:list:page:3:limit:10']
        });

      await service.invalidatePattern('customers:*');

      // Verify SCAN was called twice (cursor 0 -> 1 -> 0)
      expect(mockRedisClient.scan).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.scan).toHaveBeenNthCalledWith(1, '0', {
        MATCH: 'customers:*',
        COUNT: 100
      });
      expect(mockRedisClient.scan).toHaveBeenNthCalledWith(2, '1', {
        MATCH: 'customers:*',
        COUNT: 100
      });

      // Verify DEL was called with all matched keys as an array
      expect(mockRedisClient.del).toHaveBeenCalledWith([
        'customers:list:page:1:limit:10',
        'customers:list:page:2:limit:10',
        'customers:list:page:3:limit:10',
      ]);

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Invalidated 3 cache entries matching pattern: customers:*',
      );
    });

    it('should not call del when no keys match pattern', async () => {
      mockRedisClient.scan.mockResolvedValueOnce({ cursor: 0, keys: [] });

      await service.invalidatePattern('nonexistent:*');

      expect(mockRedisClient.scan).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should log warning when Redis client is not available', async () => {
      mockCacheManager.store.client = null;

      await service.invalidatePattern('test:*');

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Redis client not available for pattern invalidation',
      );
      expect(mockRedisClient.scan).not.toHaveBeenCalled();
    });

    it('should log error but not throw on pattern invalidation failure', async () => {
      const error = new Error('Redis connection failed');
      mockRedisClient.scan.mockRejectedValue(error);

      await expect(service.invalidatePattern('test:*')).resolves.not.toThrow();

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Cache invalidation error for pattern test:*'),
        expect.any(String),
      );
    });
  });

  describe('graceful degradation', () => {
    it('should handle all cache operations gracefully when Redis is unavailable', async () => {
      const error = new Error('Redis unavailable');
      mockCacheManager.get.mockRejectedValue(error);
      mockCacheManager.set.mockRejectedValue(error);
      mockCacheManager.del.mockRejectedValue(error);
      mockRedisClient.scan.mockRejectedValue(error);

      // All operations should succeed without throwing
      await expect(service.get('key')).resolves.toBeNull();
      await expect(service.set('key', 'value')).resolves.not.toThrow();
      await expect(service.del('key')).resolves.not.toThrow();
      await expect(service.invalidatePattern('pattern:*')).resolves.not.toThrow();

      // Verify errors were logged
      expect(Logger.prototype.error).toHaveBeenCalledTimes(4);
    });
  });
});
