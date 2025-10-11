import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function healthCheck() {
  try {
    const app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  }
}

healthCheck();
