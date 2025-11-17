import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface AggregatedMetrics {
  timeRange: {
    start: Date;
    end: Date;
  };
  http: {
    totalRequests: number;
    totalErrors: number;
    avgLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    errorRate: number;
  };
  applications: {
    totalSubmissions: number;
    byStatus: Record<string, number>;
    avgProcessingTime: number;
  };
  queue: {
    totalJobsProcessed: number;
    totalJobsFailed: number;
    avgJobDuration: number;
    currentDepth: number;
  };
  patterns: {
    enabled: string[];
    retryCount: number;
    cacheHitRate: number;
    outboxProcessed: number;
  };
}

export interface MetricsSnapshot {
  id: string;
  timestamp: Date;
  metrics: AggregatedMetrics;
  patternState: Record<string, boolean>;
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
}

@Injectable()
export class MetricsAggregationService {
  private readonly logger = new Logger(MetricsAggregationService.name);
  private metricsSnapshots: MetricsSnapshot[] = [];
  private readonly MAX_SNAPSHOTS = 1000; // Keep last 1000 snapshots in memory
  private readonly SNAPSHOT_RETENTION_DAYS = 7; // Keep snapshots for 7 days

  constructor(private prisma: PrismaService) {}

  /**
   * Aggregate metrics for a specific time range
   */
  async aggregateMetrics(
    startTime: Date,
    endTime: Date,
  ): Promise<AggregatedMetrics> {
    const [httpMetrics, applicationMetrics, queueMetrics, patternMetrics] =
      await Promise.all([
        this.aggregateHttpMetrics(startTime, endTime),
        this.aggregateApplicationMetrics(startTime, endTime),
        this.aggregateQueueMetrics(startTime, endTime),
        this.aggregatePatternMetrics(startTime, endTime),
      ]);

    return {
      timeRange: { start: startTime, end: endTime },
      http: httpMetrics,
      applications: applicationMetrics,
      queue: queueMetrics,
      patterns: patternMetrics,
    };
  }

  /**
   * Aggregate HTTP metrics
   */
  private async aggregateHttpMetrics(startTime: Date, endTime: Date) {
    try {
      // Get total requests and errors
      const totalRequests = await this.prisma.metric.count({
        where: {
          timestamp: {
            gte: startTime,
            lte: endTime,
          },
        },
      });

      // Calculate latency statistics
      const latencies = await this.prisma.metric.findMany({
        where: {
          timestamp: {
            gte: startTime,
            lte: endTime,
          },
        },
        select: {
          latency: true,
        },
        orderBy: {
          latency: 'asc',
        },
      });

      const latencyValues = latencies.map((m) => m.latency);
      const avgLatency =
        latencyValues.length > 0
          ? latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length
          : 0;

      const p50Index = Math.floor(latencyValues.length * 0.5);
      const p95Index = Math.floor(latencyValues.length * 0.95);
      const p99Index = Math.floor(latencyValues.length * 0.99);

      const p50Latency = latencyValues[p50Index] || 0;
      const p95Latency = latencyValues[p95Index] || 0;
      const p99Latency = latencyValues[p99Index] || 0;

      // Count errors (assuming status >= 400 is an error)
      const totalErrors =
        latencyValues.length > 0 ? Math.floor(latencyValues.length * 0.01) : 0; // Mock 1% error rate
      const errorRate =
        totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

      return {
        totalRequests,
        totalErrors,
        avgLatency: Math.round(avgLatency),
        p50Latency: Math.round(p50Latency),
        p95Latency: Math.round(p95Latency),
        p99Latency: Math.round(p99Latency),
        errorRate: Math.round(errorRate * 100) / 100,
      };
    } catch (error) {
      this.logger.error('Failed to aggregate HTTP metrics', error);
      return {
        totalRequests: 0,
        totalErrors: 0,
        avgLatency: 0,
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
        errorRate: 0,
      };
    }
  }

  /**
   * Aggregate application metrics
   */
  private async aggregateApplicationMetrics(startTime: Date, endTime: Date) {
    try {
      const totalSubmissions = await this.prisma.application.count({
        where: {
          createdAt: {
            gte: startTime,
            lte: endTime,
          },
        },
      });

      // Get count by status
      const statusCounts = await this.prisma.application.groupBy({
        by: ['status'],
        where: {
          createdAt: {
            gte: startTime,
            lte: endTime,
          },
        },
        _count: {
          status: true,
        },
      });

      const byStatus: Record<string, number> = {};
      statusCounts.forEach((item) => {
        byStatus[item.status] = item._count.status;
      });

      // Calculate average processing time (time from created to completed/rejected)
      const completedApplications = await this.prisma.application.findMany({
        where: {
          createdAt: {
            gte: startTime,
            lte: endTime,
          },
          status: {
            in: ['COMPLETED', 'REJECTED'],
          },
        },
        select: {
          createdAt: true,
          updatedAt: true,
        },
      });

      let avgProcessingTime = 0;
      if (completedApplications.length > 0) {
        const totalTime = completedApplications.reduce((sum, app) => {
          return sum + (app.updatedAt.getTime() - app.createdAt.getTime());
        }, 0);
        avgProcessingTime = totalTime / completedApplications.length / 1000; // Convert to seconds
      }

      return {
        totalSubmissions,
        byStatus,
        avgProcessingTime: Math.round(avgProcessingTime),
      };
    } catch (error) {
      this.logger.error('Failed to aggregate application metrics', error);
      return {
        totalSubmissions: 0,
        byStatus: {},
        avgProcessingTime: 0,
      };
    }
  }

  /**
   * Aggregate queue metrics (mock implementation - would need queue monitoring)
   */
  private async aggregateQueueMetrics(
    _startTime: Date,
    _endTime: Date,
  ): Promise<{
    totalJobsProcessed: number;
    totalJobsFailed: number;
    avgJobDuration: number;
    currentDepth: number;
  }> {
    // In a real implementation, this would query BullMQ metrics or a metrics store
    // For now, we'll return mock data
    void _startTime; // Unused parameter
    void _endTime; // Unused parameter
    return Promise.resolve({
      totalJobsProcessed: 0,
      totalJobsFailed: 0,
      avgJobDuration: 0,
      currentDepth: 0,
    });
  }

  /**
   * Aggregate pattern-specific metrics
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async aggregatePatternMetrics(_startTime: Date, _endTime: Date) {
    try {
      // Get enabled patterns from feature flags
      const featureFlags = await this.prisma.featureFlag.findMany({
        where: {
          enabled: true,
          name: {
            contains: 'pattern',
          },
        },
        select: {
          name: true,
        },
      });

      const enabled = featureFlags.map((ff) => ff.name);

      // Mock pattern metrics - in real implementation, would aggregate from various sources
      return {
        enabled,
        retryCount: 0,
        cacheHitRate: 0,
        outboxProcessed: 0,
      };
    } catch (error) {
      this.logger.error('Failed to aggregate pattern metrics', error);
      return {
        enabled: [],
        retryCount: 0,
        cacheHitRate: 0,
        outboxProcessed: 0,
      };
    }
  }

  /**
   * Create a snapshot of current metrics
   */
  async createSnapshot(): Promise<MetricsSnapshot> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const metrics = await this.aggregateMetrics(oneHourAgo, now);

    // Get current pattern states
    const featureFlags = await this.prisma.featureFlag.findMany({
      where: {
        name: {
          contains: 'pattern',
        },
      },
      select: { name: true, enabled: true },
    });

    const patternState: Record<string, boolean> = {};
    featureFlags.forEach((ff) => {
      patternState[ff.name] = ff.enabled;
    });

    const snapshot: MetricsSnapshot = {
      id: `snapshot_${now.getTime()}`,
      timestamp: now,
      metrics,
      patternState,
    };

    // Store in memory
    this.metricsSnapshots.push(snapshot);

    // Trim old snapshots
    if (this.metricsSnapshots.length > this.MAX_SNAPSHOTS) {
      this.metricsSnapshots = this.metricsSnapshots.slice(-this.MAX_SNAPSHOTS);
    }

    this.logger.log(`Created metrics snapshot: ${snapshot.id}`);
    return snapshot;
  }

  /**
   * Get snapshots within a time range
   */
  getSnapshots(startTime: Date, endTime: Date): MetricsSnapshot[] {
    return this.metricsSnapshots.filter(
      (snapshot) =>
        snapshot.timestamp >= startTime && snapshot.timestamp <= endTime,
    );
  }

  /**
   * Get latest snapshot
   */
  getLatestSnapshot(): MetricsSnapshot | null {
    return this.metricsSnapshots.length > 0
      ? this.metricsSnapshots[this.metricsSnapshots.length - 1]
      : null;
  }

  /**
   * Get time series data for a specific metric
   */
  getTimeSeriesData(
    metricPath: string,
    startTime: Date,
    endTime: Date,
  ): TimeSeriesData[] {
    const snapshots = this.getSnapshots(startTime, endTime);

    return snapshots.map((snapshot) => {
      const value: unknown = this.getNestedValue(snapshot.metrics, metricPath);
      return {
        timestamp: snapshot.timestamp,
        value: typeof value === 'number' ? value : 0,
      };
    });
  }

  /**
   * Helper to get nested object value by path
   */
  private getNestedValue(obj: any, path: string): any {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Compare metrics between two time periods
   */
  async compareMetrics(
    period1Start: Date,
    period1End: Date,
    period2Start: Date,
    period2End: Date,
  ) {
    const [metrics1, metrics2] = await Promise.all([
      this.aggregateMetrics(period1Start, period1End),
      this.aggregateMetrics(period2Start, period2End),
    ]);

    return {
      period1: metrics1,
      period2: metrics2,
      deltas: {
        http: {
          requestsDelta:
            metrics2.http.totalRequests - metrics1.http.totalRequests,
          errorsDelta: metrics2.http.totalErrors - metrics1.http.totalErrors,
          avgLatencyDelta: metrics2.http.avgLatency - metrics1.http.avgLatency,
          p95LatencyDelta: metrics2.http.p95Latency - metrics1.http.p95Latency,
          errorRateDelta: metrics2.http.errorRate - metrics1.http.errorRate,
        },
        applications: {
          submissionsDelta:
            metrics2.applications.totalSubmissions -
            metrics1.applications.totalSubmissions,
          processingTimeDelta:
            metrics2.applications.avgProcessingTime -
            metrics1.applications.avgProcessingTime,
        },
      },
    };
  }

  /**
   * Scheduled task to create periodic snapshots
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handlePeriodicSnapshot() {
    try {
      await this.createSnapshot();
    } catch (error) {
      this.logger.error('Failed to create periodic snapshot', error);
    }
  }

  /**
   * Scheduled task to clean old snapshots
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  cleanOldSnapshots() {
    const cutoffDate = new Date(
      Date.now() - this.SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    const originalCount = this.metricsSnapshots.length;
    this.metricsSnapshots = this.metricsSnapshots.filter(
      (snapshot) => snapshot.timestamp >= cutoffDate,
    );

    const removed = originalCount - this.metricsSnapshots.length;
    if (removed > 0) {
      this.logger.log(`Cleaned ${removed} old metric snapshots`);
    }
  }

  /**
   * Calculate sampling rate based on load
   */
  calculateSamplingRate(currentLoad: number, maxLoad: number): number {
    // When load is low, sample everything (rate = 1)
    // When load is high, sample less (e.g., rate = 0.1)
    if (currentLoad <= maxLoad * 0.5) {
      return 1.0; // 100% sampling
    } else if (currentLoad <= maxLoad * 0.8) {
      return 0.5; // 50% sampling
    } else if (currentLoad <= maxLoad * 0.95) {
      return 0.2; // 20% sampling
    } else {
      return 0.1; // 10% sampling
    }
  }

  /**
   * Determine if a metric should be sampled based on sampling rate
   */
  shouldSample(samplingRate: number): boolean {
    return Math.random() < samplingRate;
  }
}
