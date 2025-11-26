import { Module } from '@nestjs/common';
import { ApplicationViewService } from './application-view.service';
import { ApplicationReadService } from './application-read.service';
import { RedisCacheService } from './cache/redis-cache.service';
import { ReadController } from './read.controller';
import { ApplicationStatusStream } from './status-updates.gateway';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [FeatureFlagsModule],
  controllers: [ReadController],
  providers: [
    PrismaService,
    ApplicationViewService,
    ApplicationReadService,
    RedisCacheService,
    ApplicationStatusStream,
  ],
  exports: [ApplicationReadService, ApplicationStatusStream],
})
export class ReadModelModule {}
