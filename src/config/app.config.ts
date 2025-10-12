import { ConfigService } from '@nestjs/config';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  apiPrefix: string;
  encryptionKey: string;
  maxFileSize: number;
  uploadDest: string;
  throttleTtl: number;
  throttleLimit: number;
}

export const getAppConfig = (configService: ConfigService): AppConfig => ({
  port: configService.get<number>('PORT') || 3000,
  nodeEnv: configService.get<string>('NODE_ENV') || 'development',
  apiPrefix: configService.get<string>('API_PREFIX') || 'api/v1',
  encryptionKey:
    configService.get<string>('ENCRYPTION_KEY') ||
    'default-32-character-key-for-dev',
  maxFileSize: configService.get<number>('MAX_FILE_SIZE') || 10485760,
  uploadDest: configService.get<string>('UPLOAD_DEST') || './uploads',
  throttleTtl: configService.get<number>('THROTTLE_TTL') || 60,
  throttleLimit: configService.get<number>('THROTTLE_LIMIT') || 100,
});
