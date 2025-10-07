import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [HealthController],
  providers: [MetricsService, PrismaService],
})
export class HealthModule {}