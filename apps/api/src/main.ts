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
import { join } from 'path';
import * as fs from 'fs';
import * as express from 'express';
import { PushProvider } from './modules/notifications/providers/push.provider';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Security (allow cross-origin images for admin preview)
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(compression());

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global prefix
  const apiPrefix = configService.get<string>('API_PREFIX') || 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // Raw body for Tap webhook signature verification
  const rawPaths = [`/${apiPrefix}/payments/webhook`];
  const http = app.getHttpAdapter().getInstance();
  rawPaths.forEach((p) => http.use(p, (express as any).raw({ type: '*/*' })));

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

  // Static files serving (resolve uploads dir dynamically with env override)
  const expressInstance = app.getHttpAdapter().getInstance();
  const defaultCandidates = [
    join(__dirname, '..', '..', '..', 'uploads'),
    join(__dirname, '..', 'uploads'),
  ];
  const envUploads = configService.get<string>('UPLOAD_DEST');
  const candidates = envUploads ? [envUploads, ...defaultCandidates] : defaultCandidates;
  const uploadsRoot = candidates.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  }) || candidates[0];
  try { fs.mkdirSync(uploadsRoot, { recursive: true }); } catch {}
  const indexEnabled = (configService.get<string>('STATIC_INDEX') || '').toLowerCase() === 'true';
  expressInstance.use('/uploads', (express as any).static(uploadsRoot, { index: indexEnabled, redirect: false }));
  const loggerInfo = new Logger('Static');
  loggerInfo.log(`Serving uploads from: ${uploadsRoot} (index=${indexEnabled}) at /uploads`);

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

  // Check Firebase integration status
  try {
    const pushProvider = app.get(PushProvider);
    if (pushProvider && typeof pushProvider.getStatus === 'function') {
      const status = pushProvider.getStatus();
      logger.log('═══════════════════════════════════════════════════════════');
      if (status.initialized) {
        logger.log(`✅ Firebase Integration Status: ACTIVE`);
        if (status.projectId) {
          logger.log(`   Project ID: ${status.projectId}`);
        }
      } else {
        logger.warn(`⚠️  Firebase Integration Status: ${status.error ? 'FAILED' : 'NOT CONFIGURED'}`);
        if (status.error) {
          logger.warn(`   Error: ${status.error}`);
        }
      }
      logger.log('═══════════════════════════════════════════════════════════');
    }
  } catch (e) {
    logger.warn('Could not check Firebase status: ' + (e as Error).message);
  }
}
bootstrap();
