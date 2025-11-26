import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ApplicationView, ApplicationViewService } from './application-view.service';
import { RedisCacheService } from './cache/redis-cache.service';
import { ApplicationStatusStream } from './status-updates.gateway';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

const APPLICATION_CACHE_TTL = Number(process.env.APPLICATION_CACHE_TTL_SECONDS || 60);

@Injectable()
export class ApplicationReadService {
  private readonly logger = new Logger(ApplicationReadService.name);

  constructor(
    private readonly viewService: ApplicationViewService,
    private readonly cache: RedisCacheService,
    private readonly statusStream: ApplicationStatusStream,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  async getById(applicationId: string): Promise<ApplicationView> {
    const [useCache, useView] = await this.getFlags();
    const cacheKey = this.getApplicationKey(applicationId);
    if (useCache) {
      const cached = await this.cache.get<ApplicationView>(cacheKey);
      if (cached) return cached;
    }

    const data = await this.viewService.getView(applicationId, useView);
    if (!data) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    if (useCache) {
      await this.cache.set(cacheKey, data, APPLICATION_CACHE_TTL);
    }
    return data;
  }

  async listForUser(userId: string): Promise<ApplicationView[]> {
    const [useCache, useView] = await this.getFlags();
    const cacheKey = this.getUserListKey(userId);
    if (useCache) {
      const cached = await this.cache.get<ApplicationView[]>(cacheKey);
      if (cached) return cached;
    }

    const data = await this.viewService.listForUser(userId, useView);
    if (useCache) {
      await this.cache.set(cacheKey, data, APPLICATION_CACHE_TTL);
    }
    return data;
  }

  async refresh(applicationId: string): Promise<ApplicationView> {
    const [useCache, useView] = await this.getFlags();
    const data = await this.viewService.getView(applicationId, useView);
    if (!data) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }
    if (useCache) {
      await this.cache.set(this.getApplicationKey(applicationId), data, APPLICATION_CACHE_TTL);
      await this.cache.del(this.getUserListKey(data.userId));
    }
    this.statusStream.emit({
      applicationId,
      status: data.status,
      progress: data.progress ?? undefined,
      updatedAt: data.updatedAt,
    });
    return data;
  }

  async evict(applicationId: string): Promise<void> {
    const [useCache] = await this.getFlags();
    if (!useCache) return;

    const cached = await this.cache.get<ApplicationView>(this.getApplicationKey(applicationId));
    if (cached) {
      await this.cache.del(this.getApplicationKey(applicationId));
      await this.cache.del(this.getUserListKey(cached.userId));
    } else {
      await this.cache.del(this.getApplicationKey(applicationId));
    }
  }

  private getApplicationKey(applicationId: string) {
    return `application:${applicationId}`;
  }

  private getUserListKey(userId: string) {
    return `application:list:${userId}`;
  }

  private async getFlags(): Promise<[boolean, boolean]> {
    const cacheFlag = await this.featureFlagsService.getFlag('cache-aside');
    const viewFlag = await this.featureFlagsService.getFlag('cqrs-lite');
    return [cacheFlag?.enabled ?? false, viewFlag?.enabled ?? false];
  }
}
