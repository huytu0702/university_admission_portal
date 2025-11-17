import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { PrometheusService } from './prometheus.service';
import { MetricsAggregationService } from './metrics-aggregation.service';
import { ComparisonService } from './comparison.service';
import { MetricsController } from './metrics.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    PrometheusService,
    MetricsAggregationService,
    ComparisonService,
    PrismaService,
  ],
  exports: [
    MetricsService,
    PrometheusService,
    MetricsAggregationService,
    ComparisonService,
  ],
})
export class MetricsModule {}
