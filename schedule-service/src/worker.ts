import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationModule } from './notification/notification.module';

/**
 * Worker Entrypoint for Notification Service
 * 
 * Bootstraps only the NotificationModule as a standalone worker process
 * without HTTP server or GraphQL API. Processes email notification jobs
 * from the Bull queue connected to Redis.
 * * 
 * Usage:
 *   npm run build
 *   npm run start:worker
 * 
 * Docker:
 *   CMD ["npm", "run", "start:worker"]
 */
async function bootstrap() {
  const logger = new Logger('NotificationWorker');

  try {
    // Create application context without HTTP server
    // This initializes only the NotificationModule and its dependencies
    const app = await NestFactory.createApplicationContext(NotificationModule, {
      logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    });

    // Get configuration service for environment validation
    const configService = app.get(ConfigService);

    // Validate required environment variables
    const redisHost = configService.get<string>('REDIS_HOST');
    const redisPort = configService.get<number>('REDIS_PORT');
    const smtpHost = configService.get<string>('SMTP_HOST');
    const smtpPort = configService.get<number>('SMTP_PORT');

    if (!redisHost || !redisPort) {
      throw new Error(
        'Missing required Redis configuration: REDIS_HOST and REDIS_PORT must be set'
      );
    }

    if (!smtpHost || !smtpPort) {
      throw new Error(
        'Missing required SMTP configuration: SMTP_HOST and SMTP_PORT must be set'
      );
    }

    // Log worker startup information
    logger.log('========================================');
    logger.log('Notification Worker Started Successfully');
    logger.log('========================================');
    logger.log(`Redis Connection: ${redisHost}:${redisPort}`);
    logger.log(`SMTP Server: ${smtpHost}:${smtpPort}`);
    logger.log('Queue: notification');
    logger.log('Waiting for email jobs...');
    logger.log('========================================');

    // The Bull processor will automatically start consuming jobs
    // No need to explicitly call any processing method
    // The worker will run indefinitely until terminated

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.log('SIGTERM signal received: closing worker gracefully');
      await app.close();
      logger.log('Worker closed');
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.log('SIGINT signal received: closing worker gracefully');
      await app.close();
      logger.log('Worker closed');
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start notification worker', error.stack);
    process.exit(1);
  }
}

bootstrap();
