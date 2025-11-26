import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: Redis | null;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const useTls = process.env.REDIS_TLS === 'true';

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      tls: useTls ? {} : undefined,
    });

    this.client.on('error', (err) => {
      this.logger.warn(`Redis connection issue: ${err.message}`);
    });
  }

  private async getClient(): Promise<Redis | null> {
    if (!this.client) return null;
    if (this.client.status === 'wait' || this.client.status === 'connecting') {
      try {
        await this.client.connect();
      } catch (err) {
        this.logger.warn(`Redis connect failed, skipping cache: ${(err as Error).message}`);
        return null;
      }
    }

    if (this.client.status !== 'ready') {
      return null;
    }

    return this.client;
  }

  async get<T>(key: string): Promise<T | null> {
    const client = await this.getClient();
    if (!client) return null;
    const value = await client.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
    const client = await this.getClient();
    if (!client) return;
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    const client = await this.getClient();
    if (!client) return;
    await client.del(key);
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }
}
