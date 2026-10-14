import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

// CACHE_MANAGER token - matches @nestjs/cache-manager constant
export const CACHE_MANAGER = 'CACHE_MANAGER';

/**
 * CacheService provides a graceful degradation wrapper around CacheManager.
 * All cache operations are non-blocking - failures return null or log errors without throwing.
 * */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly DEFAULT_TTL = 300; // 5 minutes in seconds

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Get a value from cache by key.
   * Returns null on cache miss or error (graceful degradation).
   * 
   * @param key - Cache key
   * @returns Cached value or null
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cacheManager.get<T>(key);
      return value ?? null;
    } catch (error) {
      this.logger.error(`Cache read error for key ${key}: ${error.message}`, error.stack);
      return null; // Graceful degradation - return null on error
    }
  }

  /**
   * Set a value in cache with TTL.
   * Logs errors but does not throw (graceful degradation).
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (default: 300 seconds / 5 minutes)
   */
  async set(key: string, value: any, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl * 1000); // Convert to milliseconds
    } catch (error) {
      this.logger.error(`Cache write error for key ${key}: ${error.message}`, error.stack);
      // Continue without caching - graceful degradation
    }
  }

  /**
   * Delete a specific key from cache.
   * Logs errors but does not throw (graceful degradation).
   * 
   * @param key - Cache key to delete
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
    } catch (error) {
      this.logger.error(`Cache deletion error for key ${key}: ${error.message}`, error.stack);
      // Continue without deletion - graceful degradation
    }
  }

  /**
   * Invalidate all cache entries matching a pattern (e.g., "customers:*").
   * Uses Redis SCAN command with pattern matching followed by DEL.
   * Logs errors but does not throw (graceful degradation).
   * 
   * @param pattern - Redis key pattern (e.g., "customers:*", "doctors:*")
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // Access the underlying Redis client from the store
      // With cache-manager-redis-yet, we need to access it differently
      const store = (this.cacheManager as any).store;
      
      if (!store || !store.client) {
        this.logger.warn('Redis client not available for pattern invalidation');
        return;
      }

      const redisClient = store.client;

      // Use Redis SCAN to find keys matching pattern
      const keys: string[] = [];
      let cursor = '0';

      do {
        const result = await redisClient.scan(cursor, {
          MATCH: pattern,
          COUNT: 100
        });
        cursor = result.cursor.toString();
        keys.push(...result.keys);
      } while (cursor !== '0');

      // Delete all matched keys
      if (keys.length > 0) {
        await redisClient.del(keys);
        this.logger.log(`Invalidated ${keys.length} cache entries matching pattern: ${pattern}`);
      }
    } catch (error) {
      this.logger.error(
        `Cache invalidation error for pattern ${pattern}: ${error.message}`,
        error.stack,
      );
      // Continue without invalidation - graceful degradation
    }
  }
}
