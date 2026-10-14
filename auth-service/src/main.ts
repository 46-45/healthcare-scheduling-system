import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AuthModule);

    // Enable validation pipes globally
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Get configuration service
    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT', 3001);

    // Enable CORS for microservice communication
    app.enableCors({
      origin: true,
      credentials: true,
    });

    await app.listen(port);

    logger.log(`Auth Service running on http://localhost:${port}`);
    logger.log(`GraphQL Playground available at http://localhost:${port}/graphql`);
  } catch (error) {
    logger.error('Failed to start Auth Service', error);
    process.exit(1);
  }
}

bootstrap();
