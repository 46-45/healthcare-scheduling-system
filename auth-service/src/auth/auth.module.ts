import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_FILTER } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from '../health/health.controller';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { GraphQLExceptionFilter } from '../common/filters/graphql-exception.filter';

@Module({
  imports: [
    // Environment configuration with validation
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => {
        const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];
        const missing = requiredVars.filter((varName) => !config[varName]);
        
        if (missing.length > 0) {
          throw new Error(
            `Missing required environment variables: ${missing.join(', ')}`
          );
        }
        
        return config;
      },
    }),

    // GraphQL module with Apollo Server 4
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      introspection: true,
      formatError: (error) => {
        return {
          message: error.message,
          code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
          locations: error.locations,
          path: error.path,
        };
      },
    }),

    // JWT module with dynamic configuration
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '3600') + 's',
        },
      }),
      inject: [ConfigService],
    }),

    // Prisma database module
    PrismaModule,
  ],
  controllers: [HealthController],
  providers: [
    AuthService,
    AuthResolver,
    // Register global exception filter
    {
      provide: APP_FILTER,
      useClass: GraphQLExceptionFilter,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
