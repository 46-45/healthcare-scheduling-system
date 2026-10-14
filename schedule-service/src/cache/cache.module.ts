import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * CacheModule provides CacheService as a global module.
 * CacheService wraps @nestjs/cache-manager with graceful degradation.
 * */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheServiceModule {}
