import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('DATABASE_HOST'),
  port: configService.get<number>('DATABASE_PORT'),
  username: configService.get<string>('DATABASE_USERNAME'),
  password: configService.get<string>('DATABASE_PASSWORD'),
  database: configService.get<string>('DATABASE_NAME'),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  // Allow forcing synchronize via env for first-time bootstrap
  synchronize: (() => {
    const syncEnv = (configService.get<string>('DATABASE_SYNCHRONIZE') || '').toLowerCase();
    if (syncEnv === 'true' || syncEnv === '1' || syncEnv === 'yes') return true;
    return configService.get<string>('NODE_ENV') === 'development';
  })(),
  logging: configService.get<string>('NODE_ENV') === 'development',
  // Make SSL optional via env flag; default to disabled
  ssl: (() => {
    const sslEnv = (configService.get<string>('DATABASE_SSL') || '').toLowerCase();
    const enabled = sslEnv === 'true' || sslEnv === '1' || sslEnv === 'yes';
    return enabled ? { rejectUnauthorized: false } : false;
  })(),
});
