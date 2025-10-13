import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { getRedisConfig } from '../config/redis.config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.client = new Redis(getRedisConfig(this.configService));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  // OTP Management
  async setOTP(phone: string, otp: string, ttl: number = 300): Promise<void> {
    await this.client.setex(`otp:${phone}`, ttl, otp);
  }

  async getOTP(phone: string): Promise<string | null> {
    return await this.client.get(`otp:${phone}`);
  }

  async deleteOTP(phone: string): Promise<void> {
    await this.client.del(`otp:${phone}`);
  }

  // Session Management
  async setSession(
    sessionId: string,
    data: any,
    ttl: number = 86400,
  ): Promise<void> {
    await this.client.setex(`session:${sessionId}`, ttl, JSON.stringify(data));
  }

  async getSession(sessionId: string): Promise<any> {
    const data = await this.client.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.del(`session:${sessionId}`);
  }

  // Rate Limiting
  async incrementRateLimit(key: string, ttl: number = 60): Promise<number> {
    const current = await this.client.incr(`rate:${key}`);
    if (current === 1) {
      await this.client.expire(`rate:${key}`, ttl);
    }
    return current;
  }

  async getRateLimit(key: string): Promise<number> {
    const count = await this.client.get(`rate:${key}`);
    return count ? parseInt(count, 10) : 0;
  }

  // Caching
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async get(key: string): Promise<any> {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  // Lock mechanism for critical operations
  async acquireLock(key: string, ttl: number = 30): Promise<boolean> {
    const result = await this.client.set(`lock:${key}`, '1', 'EX', ttl, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.client.del(`lock:${key}`);
  }
}
