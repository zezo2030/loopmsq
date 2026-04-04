import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const sslEnv = (process.env.DATABASE_SSL || '').toLowerCase();
const sslEnabled = sslEnv === 'true' || sslEnv === '1' || sslEnv === 'yes';

const dbPassword =
  process.env.DATABASE_PASSWORD ?? process.env.POSTGRES_PASSWORD ?? '';

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: String(dbPassword),
  database: process.env.DATABASE_NAME || 'booking_platform',
  entities: [path.join(__dirname, '/**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, '/database/migrations/*{.ts,.js}')],
  ssl: sslEnabled ? { rejectUnauthorized: false } : false,
});
