import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Security
  app.use(helmet());
  app.use(compression());

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global prefix
  const apiPrefix = configService.get<string>('API_PREFIX') || 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global throttler guard
  // Note: ThrottlerGuard will be applied via module configuration

  // Swagger documentation
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Booking Platform API')
      .setDescription('NestJS Booking Platform Backend API Documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management endpoints')
      .addTag('bookings', 'Booking management endpoints')
      .addTag('payments', 'Payment processing endpoints')
      .addTag('trips', 'School trips endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document);
  }

  // Bull Board - Queues dashboard
  try {
    const smsQueue = app.get<Queue>(getQueueToken('notifications_sms'));
    const emailQueue = app.get<Queue>(getQueueToken('notifications_email'));
    const pushQueue = app.get<Queue>(getQueueToken('notifications_push'));
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath(`/${apiPrefix}/queues`);
    createBullBoard({
      queues: [new BullAdapter(smsQueue), new BullAdapter(emailQueue), new BullAdapter(pushQueue)],
      serverAdapter,
    });
    const expressInstance: any = app.getHttpAdapter().getInstance();
    expressInstance.use(`/${apiPrefix}/queues`, serverAdapter.getRouter());
  } catch (e) {
    logger.warn('Bull Board initialization skipped: ' + (e as Error).message);
  }

  // Serve static files
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);

  logger.log(
    `Application is running on: http://localhost:${port}/${apiPrefix}`,
  );
  try {
    logger.log(`Queues dashboard: http://localhost:${port}/${apiPrefix}/queues`);
  } catch {}
  if (configService.get<string>('NODE_ENV') !== 'production') {
    logger.log(
      `Swagger documentation: http://localhost:${port}/${apiPrefix}/docs`,
    );
  }
}
bootstrap();
