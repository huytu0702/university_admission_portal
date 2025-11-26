import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ApplicationViewService } from './application-view.service';
import { ApplicationReadService } from './application-read.service';
import { RedisCacheService } from './cache/redis-cache.service';
import { ReadController } from './read.controller';
import { ApplicationStatusStream } from './status-updates.gateway';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [PrismaModule, FeatureFlagsModule],
  controllers: [ReadController],
  providers: [
    ApplicationViewService,
    ApplicationReadService,
    RedisCacheService,
    ApplicationStatusStream,
  ],
  exports: [ApplicationReadService, ApplicationStatusStream],
})
export class ReadModelModule {}
