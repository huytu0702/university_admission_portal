import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LatencyMetric {
  endpoint: string;
  method: string;
  latency: number; // in milliseconds
  timestamp: Date;
  userId?: string;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(private prisma: PrismaService) { }

  /**
   * Record a latency metric for an endpoint
   */
  async recordLatency(metric: LatencyMetric): Promise<void> {
    try {
      // In a production environment, you might want to batch these metrics
      // and insert them periodically to reduce database load
      await this.prisma.metric.create({
        data: {
          endpoint: metric.endpoint,
          method: metric.method,
          latency: metric.latency,
          timestamp: metric.timestamp,
          userId: metric.userId || null,
        },
      });
    } catch (error) {
      this.logger.error('Failed to record latency metric', error);
    }
  }

  /**
   * Get average latency for an endpoint over a time period
   */
  async getAverageLatency(
    endpoint: string,
    method: string,
    startTime: Date,
    endTime: Date,
  ): Promise<number> {
    try {
      const result = await this.prisma.$queryRaw<{ avg_latency: number }[]>`
        SELECT AVG(latency) as avg_latency
        FROM metrics
        WHERE endpoint = ${endpoint}
          AND method = ${method}
          AND timestamp >= ${startTime}
          AND timestamp <= ${endTime}
      `;

      return result[0]?.avg_latency || 0;
    } catch (error) {
      this.logger.error('Failed to get average latency', error);
      return 0;
    }
  }

  /**
   * Get latency percentiles for an endpoint
   */
  async getLatencyPercentiles(
    endpoint: string,
    method: string,
    startTime: Date,
    endTime: Date,
    percentiles: number[] = [50, 95, 99],
  ): Promise<Record<number, number>> {
    try {
      const results: Record<number, number> = {};

      for (const percentile of percentiles) {
        const result = await this.prisma.$queryRaw<{ percentile_value: number }[]>`
          SELECT PERCENTILE_CONT(${percentile / 100.0}) WITHIN GROUP (ORDER BY latency) as percentile_value
          FROM metrics
          WHERE endpoint = ${endpoint}
            AND method = ${method}
            AND timestamp >= ${startTime}
            AND timestamp <= ${endTime}
        `;

        results[percentile] = result[0]?.percentile_value || 0;
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to get latency percentiles', error);
      return {};
    }
  }

  /**
   * Get throughput (requests per minute) for an endpoint
   */
  async getThroughput(
    endpoint: string,
    method: string,
    startTime: Date,
    endTime: Date,
  ): Promise<number> {
    try {
      const result = await this.prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*) as count
        FROM metrics
        WHERE endpoint = ${endpoint}
          AND method = ${method}
          AND timestamp >= ${startTime}
          AND timestamp <= ${endTime}
      `;

      const timeDiffMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
      return timeDiffMinutes > 0 ? result[0].count / timeDiffMinutes : 0;
    } catch (error) {
      this.logger.error('Failed to get throughput', error);
      return 0;
    }
  }
}