import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

// #region agent log
const DEBUG_LOG_ENDPOINT = 'http://127.0.0.1:7242/ingest/2e2472bd-ae94-4601-b07f-fbff218202a0';
function debugLog(location: string, message: string, data: any, hypothesisId?: string) {
  fetch(DEBUG_LOG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location,
      message,
      data,
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId,
    }),
  }).catch(() => {});
}
// #endregion

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const synchronize = (() => {
    const syncEnv = (configService.get<string>('DATABASE_SYNCHRONIZE') || '').toLowerCase();
    if (syncEnv === 'true' || syncEnv === '1' || syncEnv === 'yes') return true;
    return configService.get<string>('NODE_ENV') === 'development';
  })();

  // #region agent log
  debugLog('database.config.ts:getDatabaseConfig', 'Database config created', {
    synchronize,
    nodeEnv: configService.get<string>('NODE_ENV'),
    databaseName: configService.get<string>('DATABASE_NAME'),
    entitiesPath: __dirname + '/../**/*.entity{.ts,.js}',
  }, 'A');
  // #endregion

  return {
    type: 'postgres',
    host: configService.get<string>('DATABASE_HOST'),
    port: configService.get<number>('DATABASE_PORT'),
    username: configService.get<string>('DATABASE_USERNAME'),
    password: configService.get<string>('DATABASE_PASSWORD'),
    database: configService.get<string>('DATABASE_NAME'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    // Allow forcing synchronize via env for first-time bootstrap
    synchronize,
    logging: configService.get<string>('NODE_ENV') === 'development',
    // Make SSL optional via env flag; default to disabled
    ssl: (() => {
      const sslEnv = (configService.get<string>('DATABASE_SSL') || '').toLowerCase();
      const enabled = sslEnv === 'true' || sslEnv === '1' || sslEnv === 'yes';
      return enabled ? { rejectUnauthorized: false } : false;
    })(),
  };
};
