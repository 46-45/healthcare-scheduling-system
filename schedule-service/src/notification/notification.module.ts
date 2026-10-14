import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationProcessor } from './notification.processor';

/**
 * NotificationModule
 * 
 * Configures Bull queue for asynchronous email notification processing.
 * Can be used standalone in worker mode or imported by ScheduleModule.
 * */
@Module({
  imports: [
    // Environment Configuration
    // Configured globally to support standalone worker mode
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Configure Bull with Redis connection
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST');
        const redisPort = configService.get<number>('REDIS_PORT');

        // Validate required Redis environment variables
        if (!redisHost || !redisPort) {
          throw new Error(
            'Missing required Redis configuration: REDIS_HOST and REDIS_PORT must be set in .env file'
          );
        }

        return {
          redis: {
            host: redisHost,
            port: redisPort,
          },
        };
      },
    }),

    // Register 'notification' queue with retry and backoff configuration
    //
    BullModule.registerQueue({
      name: 'notification',
      defaultJobOptions: {
        attempts: 3, // 1 initial attempt + 2 retries
        backoff: {
          type: 'exponential',
          delay: 1000, // Start with 1 second, doubles on each retry
        },
        removeOnComplete: true,
        removeOnFail: false, // Keep failed jobs for debugging
      },
    }),
  ],
  providers: [NotificationProcessor],
  exports: [BullModule], // Export to make queue available to other modules
})
export class NotificationModule {}

// Export NotificationProcessor for testing
export { NotificationProcessor } from './notification.processor';
