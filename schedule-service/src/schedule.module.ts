import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { PrismaModule } from './prisma/prisma.module';
import { CustomersModule } from './customers/customers.module';
import { DoctorsModule } from './doctors/doctors.module';
import { SchedulesModule } from './schedules/schedules.module';
import { NotificationModule } from './notification/notification.module';
import { HealthController } from './health/health.controller';
import { CacheServiceModule } from './cache/cache.module';

@Module({
  imports: [
    // Environment Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: (config) => {
        // Validate required environment variables at startup
        const requiredVars = ['DATABASE_URL', 'AUTH_SERVICE_URL', 'REDIS_HOST', 'REDIS_PORT'];
        const missingVars = requiredVars.filter((varName) => !config[varName]);

        if (missingVars.length > 0) {
          throw new Error(
            `Missing required environment variables: ${missingVars.join(', ')}. ` +
            `Please ensure these variables are set in your .env file.`
          );
        }

        return config;
      },
    }),

    // GraphQL Module with Apollo Server 4
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true, // Generate schema file automatically from decorators
      sortSchema: true,
      introspection: true, // Enable introspection
      formatError: (error) => {
        // Return formatted GraphQL errors with code in extensions
        return {
          message: error.message,
          extensions: {
            code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
            ...error.extensions,
          },
        };
      },
    }),

    // HTTP Module for Auth Service communication (globally available)
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        baseURL: configService.get<string>('AUTH_SERVICE_URL'),
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    }),

    // Cache Module with Redis for performance optimization
    CacheModule.registerAsync({
      isGlobal: true, // Register globally for use across all modules
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const store = await redisStore({
          socket: {
            host: configService.get<string>('REDIS_HOST'),
            port: configService.get<number>('REDIS_PORT'),
          },
        });

        return {
          store,
          ttl: 300000, // Default TTL: 300 seconds (5 minutes) in milliseconds
        };
      },
    }),

    // Prisma Database Module
    PrismaModule,

    // Cache Service Module (provides CacheService globally)
    CacheServiceModule,

    // Notification Module with Bull Queue
    NotificationModule,

    // Feature Modules
    CustomersModule,
    DoctorsModule,
    SchedulesModule,
  ],
  controllers: [HealthController], // Health check endpoint
})
export class ScheduleModule {}
