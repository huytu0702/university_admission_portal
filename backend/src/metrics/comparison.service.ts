import { Injectable, Logger } from '@nestjs/common';
import {
  MetricsAggregationService,
  AggregatedMetrics,
  MetricsSnapshot,
} from './metrics-aggregation.service';
import { PrismaService } from '../prisma/prisma.service';

export interface PatternToggleEvent {
  timestamp: Date;
  patternName: string;
  enabled: boolean;
  userId?: string;
}

export interface ComparisonResult {
  period1: {
    label: string;
    timeRange: { start: Date; end: Date };
    metrics: AggregatedMetrics;
    patternState: Record<string, boolean>;
  };
  period2: {
    label: string;
    timeRange: { start: Date; end: Date };
    metrics: AggregatedMetrics;
    patternState: Record<string, boolean>;
  };
  deltas: {
    http: {
      requestsDelta: number;
      requestsPercentChange: number;
      errorsDelta: number;
      errorsPercentChange: number;
      avgLatencyDelta: number;
      avgLatencyPercentChange: number;
      p95LatencyDelta: number;
      p95LatencyPercentChange: number;
      errorRateDelta: number;
      errorRatePercentChange: number;
    };
    applications: {
      submissionsDelta: number;
      submissionsPercentChange: number;
      processingTimeDelta: number;
      processingTimePercentChange: number;
    };
    queue: {
      jobsProcessedDelta: number;
      jobsProcessedPercentChange: number;
      jobsFailedDelta: number;
      jobsFailedPercentChange: number;
      avgJobDurationDelta: number;
      avgJobDurationPercentChange: number;
    };
  };
  patternChanges: {
    enabled: string[];
    disabled: string[];
    unchanged: string[];
  };
  improvement: {
    overall: 'improved' | 'degraded' | 'neutral';
    score: number; // -100 to 100
    factors: {
      latency: number;
      throughput: number;
      errorRate: number;
      reliability: number;
    };
  };
}

export interface PatternImpactAnalysis {
  patternName: string;
  enabled: boolean;
  periodBefore: { start: Date; end: Date };
  periodAfter: { start: Date; end: Date };
  impact: {
    latencyChange: number;
    throughputChange: number;
    errorRateChange: number;
    reliabilityScore: number;
  };
  metrics: {
    before: AggregatedMetrics;
    after: AggregatedMetrics;
  };
}

@Injectable()
export class ComparisonService {
  private readonly logger = new Logger(ComparisonService.name);
  private patternToggleHistory: PatternToggleEvent[] = [];

  constructor(
    private metricsAggregation: MetricsAggregationService,
    private prisma: PrismaService,
  ) {}

  /**
   * Compare metrics between two time periods with detailed analysis
   */
  async compareMetricsPeriods(
    period1Start: Date,
    period1End: Date,
    period2Start: Date,
    period2End: Date,
    period1Label = 'Before',
    period2Label = 'After',
  ): Promise<ComparisonResult> {
    // Get metrics for both periods
    const [metrics1, metrics2] = await Promise.all([
      this.metricsAggregation.aggregateMetrics(period1Start, period1End),
      this.metricsAggregation.aggregateMetrics(period2Start, period2End),
    ]);

    // Get pattern states for both periods
    const snapshot1 = this.getPatternStateAtTime(period1End);
    const snapshot2 = this.getPatternStateAtTime(period2End);

    // Calculate deltas with percentage changes
    const deltas = this.calculateDeltas(metrics1, metrics2);

    // Analyze pattern changes
    const patternChanges = this.analyzePatternChanges(
      snapshot1?.patternState || {},
      snapshot2?.patternState || {},
    );

    // Calculate improvement score
    const improvement = this.calculateImprovementScore(metrics1, metrics2);

    return {
      period1: {
        label: period1Label,
        timeRange: { start: period1Start, end: period1End },
        metrics: metrics1,
        patternState: snapshot1?.patternState || {},
      },
      period2: {
        label: period2Label,
        timeRange: { start: period2Start, end: period2End },
        metrics: metrics2,
        patternState: snapshot2?.patternState || {},
      },
      deltas,
      patternChanges,
      improvement,
    };
  }

  /**
   * Calculate all deltas with percentage changes
   */
  private calculateDeltas(
    metrics1: AggregatedMetrics,
    metrics2: AggregatedMetrics,
  ) {
    return {
      http: {
        requestsDelta:
          metrics2.http.totalRequests - metrics1.http.totalRequests,
        requestsPercentChange: this.percentChange(
          metrics1.http.totalRequests,
          metrics2.http.totalRequests,
        ),
        errorsDelta: metrics2.http.totalErrors - metrics1.http.totalErrors,
        errorsPercentChange: this.percentChange(
          metrics1.http.totalErrors,
          metrics2.http.totalErrors,
        ),
        avgLatencyDelta: metrics2.http.avgLatency - metrics1.http.avgLatency,
        avgLatencyPercentChange: this.percentChange(
          metrics1.http.avgLatency,
          metrics2.http.avgLatency,
        ),
        p95LatencyDelta: metrics2.http.p95Latency - metrics1.http.p95Latency,
        p95LatencyPercentChange: this.percentChange(
          metrics1.http.p95Latency,
          metrics2.http.p95Latency,
        ),
        errorRateDelta: metrics2.http.errorRate - metrics1.http.errorRate,
        errorRatePercentChange: this.percentChange(
          metrics1.http.errorRate,
          metrics2.http.errorRate,
        ),
      },
      applications: {
        submissionsDelta:
          metrics2.applications.totalSubmissions -
          metrics1.applications.totalSubmissions,
        submissionsPercentChange: this.percentChange(
          metrics1.applications.totalSubmissions,
          metrics2.applications.totalSubmissions,
        ),
        processingTimeDelta:
          metrics2.applications.avgProcessingTime -
          metrics1.applications.avgProcessingTime,
        processingTimePercentChange: this.percentChange(
          metrics1.applications.avgProcessingTime,
          metrics2.applications.avgProcessingTime,
        ),
      },
      queue: {
        jobsProcessedDelta:
          metrics2.queue.totalJobsProcessed - metrics1.queue.totalJobsProcessed,
        jobsProcessedPercentChange: this.percentChange(
          metrics1.queue.totalJobsProcessed,
          metrics2.queue.totalJobsProcessed,
        ),
        jobsFailedDelta:
          metrics2.queue.totalJobsFailed - metrics1.queue.totalJobsFailed,
        jobsFailedPercentChange: this.percentChange(
          metrics1.queue.totalJobsFailed,
          metrics2.queue.totalJobsFailed,
        ),
        avgJobDurationDelta:
          metrics2.queue.avgJobDuration - metrics1.queue.avgJobDuration,
        avgJobDurationPercentChange: this.percentChange(
          metrics1.queue.avgJobDuration,
          metrics2.queue.avgJobDuration,
        ),
      },
    };
  }

  /**
   * Calculate percentage change between two values
   */
  private percentChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) {
      return newValue === 0 ? 0 : 100;
    }
    return ((newValue - oldValue) / oldValue) * 100;
  }

  /**
   * Analyze pattern state changes between two periods
   */
  private analyzePatternChanges(
    state1: Record<string, boolean>,
    state2: Record<string, boolean>,
  ) {
    const allPatterns = new Set([
      ...Object.keys(state1),
      ...Object.keys(state2),
    ]);
    const enabled: string[] = [];
    const disabled: string[] = [];
    const unchanged: string[] = [];

    allPatterns.forEach((pattern) => {
      const before = state1[pattern] || false;
      const after = state2[pattern] || false;

      if (before === after) {
        unchanged.push(pattern);
      } else if (!before && after) {
        enabled.push(pattern);
      } else if (before && !after) {
        disabled.push(pattern);
      }
    });

    return { enabled, disabled, unchanged };
  }

  /**
   * Calculate overall improvement score based on metrics
   */
  private calculateImprovementScore(
    metrics1: AggregatedMetrics,
    metrics2: AggregatedMetrics,
  ) {
    // Calculate individual factor scores (-100 to 100)
    const latencyScore = this.calculateLatencyScore(metrics1, metrics2);
    const throughputScore = this.calculateThroughputScore(metrics1, metrics2);
    const errorRateScore = this.calculateErrorRateScore(metrics1, metrics2);
    const reliabilityScore = this.calculateReliabilityScore(metrics1, metrics2);

    // Weighted average
    const overallScore =
      latencyScore * 0.3 +
      throughputScore * 0.3 +
      errorRateScore * 0.25 +
      reliabilityScore * 0.15;

    let overall: 'improved' | 'degraded' | 'neutral';
    if (overallScore > 10) {
      overall = 'improved';
    } else if (overallScore < -10) {
      overall = 'degraded';
    } else {
      overall = 'neutral';
    }

    return {
      overall,
      score: Math.round(overallScore * 10) / 10,
      factors: {
        latency: Math.round(latencyScore * 10) / 10,
        throughput: Math.round(throughputScore * 10) / 10,
        errorRate: Math.round(errorRateScore * 10) / 10,
        reliability: Math.round(reliabilityScore * 10) / 10,
      },
    };
  }

  private calculateLatencyScore(
    metrics1: AggregatedMetrics,
    metrics2: AggregatedMetrics,
  ): number {
    const p95Change = this.percentChange(
      metrics1.http.p95Latency,
      metrics2.http.p95Latency,
    );
    // Lower latency is better, so negate the change
    return Math.max(-100, Math.min(100, -p95Change));
  }

  private calculateThroughputScore(
    metrics1: AggregatedMetrics,
    metrics2: AggregatedMetrics,
  ): number {
    const requestChange = this.percentChange(
      metrics1.http.totalRequests,
      metrics2.http.totalRequests,
    );
    // Higher throughput is better
    return Math.max(-100, Math.min(100, requestChange));
  }

  private calculateErrorRateScore(
    metrics1: AggregatedMetrics,
    metrics2: AggregatedMetrics,
  ): number {
    const errorRateChange = this.percentChange(
      metrics1.http.errorRate,
      metrics2.http.errorRate,
    );
    // Lower error rate is better, so negate the change
    return Math.max(-100, Math.min(100, -errorRateChange));
  }

  private calculateReliabilityScore(
    metrics1: AggregatedMetrics,
    metrics2: AggregatedMetrics,
  ): number {
    const failureRateChange = this.percentChange(
      metrics1.queue.totalJobsFailed || 1,
      metrics2.queue.totalJobsFailed || 1,
    );
    // Lower failure rate is better
    return Math.max(-100, Math.min(100, -failureRateChange));
  }

  /**
   * Get pattern state at a specific time
   */
  private getPatternStateAtTime(time: Date): MetricsSnapshot | null {
    const snapshots = this.metricsAggregation.getSnapshots(
      new Date(time.getTime() - 5 * 60 * 1000),
      time,
    );

    return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  }

  /**
   * Analyze the impact of a specific pattern toggle
   */
  async analyzePatternImpact(
    patternName: string,
    toggleTime: Date,
    beforeDuration = 3600000, // 1 hour before
    afterDuration = 3600000, // 1 hour after
  ): Promise<PatternImpactAnalysis> {
    const periodBefore = {
      start: new Date(toggleTime.getTime() - beforeDuration),
      end: toggleTime,
    };

    const periodAfter = {
      start: toggleTime,
      end: new Date(toggleTime.getTime() + afterDuration),
    };

    const [metricsBefore, metricsAfter] = await Promise.all([
      this.metricsAggregation.aggregateMetrics(
        periodBefore.start,
        periodBefore.end,
      ),
      this.metricsAggregation.aggregateMetrics(
        periodAfter.start,
        periodAfter.end,
      ),
    ]);

    const patternState = this.getPatternStateAtTime(
      new Date(toggleTime.getTime() + 1000),
    );
    const enabled = patternState?.patternState[patternName] || false;

    return {
      patternName,
      enabled,
      periodBefore,
      periodAfter,
      impact: {
        latencyChange: this.percentChange(
          metricsBefore.http.p95Latency,
          metricsAfter.http.p95Latency,
        ),
        throughputChange: this.percentChange(
          metricsBefore.http.totalRequests,
          metricsAfter.http.totalRequests,
        ),
        errorRateChange: this.percentChange(
          metricsBefore.http.errorRate,
          metricsAfter.http.errorRate,
        ),
        reliabilityScore: this.calculateReliabilityScore(
          metricsBefore,
          metricsAfter,
        ),
      },
      metrics: {
        before: metricsBefore,
        after: metricsAfter,
      },
    };
  }

  /**
   * Record a pattern toggle event
   */
  recordPatternToggle(
    patternName: string,
    enabled: boolean,
    userId?: string,
  ): void {
    const event: PatternToggleEvent = {
      timestamp: new Date(),
      patternName,
      enabled,
      userId,
    };

    this.patternToggleHistory.push(event);
    this.logger.log(
      `Pattern toggle recorded: ${patternName} ${enabled ? 'enabled' : 'disabled'}`,
    );

    // Keep only last 1000 events
    if (this.patternToggleHistory.length > 1000) {
      this.patternToggleHistory = this.patternToggleHistory.slice(-1000);
    }
  }

  /**
   * Get pattern toggle history for a time range
   */
  getPatternToggleHistory(
    startTime: Date,
    endTime: Date,
  ): PatternToggleEvent[] {
    return this.patternToggleHistory.filter(
      (event) => event.timestamp >= startTime && event.timestamp <= endTime,
    );
  }

  /**
   * Export comparison data as JSON
   */
  async exportComparisonJSON(
    period1Start: Date,
    period1End: Date,
    period2Start: Date,
    period2End: Date,
  ): Promise<string> {
    const comparison = await this.compareMetricsPeriods(
      period1Start,
      period1End,
      period2Start,
      period2End,
    );

    return JSON.stringify(comparison, null, 2);
  }

  /**
   * Export comparison data as CSV
   */
  async exportComparisonCSV(
    period1Start: Date,
    period1End: Date,
    period2Start: Date,
    period2End: Date,
  ): Promise<string> {
    const comparison = await this.compareMetricsPeriods(
      period1Start,
      period1End,
      period2Start,
      period2End,
    );

    const rows: string[] = [];

    // Header
    rows.push('Metric,Period 1,Period 2,Delta,Percent Change');

    // HTTP Metrics
    rows.push(
      `Total Requests,${comparison.period1.metrics.http.totalRequests},${comparison.period2.metrics.http.totalRequests},${comparison.deltas.http.requestsDelta},${comparison.deltas.http.requestsPercentChange.toFixed(2)}%`,
    );
    rows.push(
      `Total Errors,${comparison.period1.metrics.http.totalErrors},${comparison.period2.metrics.http.totalErrors},${comparison.deltas.http.errorsDelta},${comparison.deltas.http.errorsPercentChange.toFixed(2)}%`,
    );
    rows.push(
      `Avg Latency (ms),${comparison.period1.metrics.http.avgLatency},${comparison.period2.metrics.http.avgLatency},${comparison.deltas.http.avgLatencyDelta},${comparison.deltas.http.avgLatencyPercentChange.toFixed(2)}%`,
    );
    rows.push(
      `P95 Latency (ms),${comparison.period1.metrics.http.p95Latency},${comparison.period2.metrics.http.p95Latency},${comparison.deltas.http.p95LatencyDelta},${comparison.deltas.http.p95LatencyPercentChange.toFixed(2)}%`,
    );
    rows.push(
      `Error Rate (%),${comparison.period1.metrics.http.errorRate},${comparison.period2.metrics.http.errorRate},${comparison.deltas.http.errorRateDelta},${comparison.deltas.http.errorRatePercentChange.toFixed(2)}%`,
    );

    // Application Metrics
    rows.push(
      `Total Submissions,${comparison.period1.metrics.applications.totalSubmissions},${comparison.period2.metrics.applications.totalSubmissions},${comparison.deltas.applications.submissionsDelta},${comparison.deltas.applications.submissionsPercentChange.toFixed(2)}%`,
    );
    rows.push(
      `Avg Processing Time (s),${comparison.period1.metrics.applications.avgProcessingTime},${comparison.period2.metrics.applications.avgProcessingTime},${comparison.deltas.applications.processingTimeDelta},${comparison.deltas.applications.processingTimePercentChange.toFixed(2)}%`,
    );

    // Queue Metrics
    rows.push(
      `Jobs Processed,${comparison.period1.metrics.queue.totalJobsProcessed},${comparison.period2.metrics.queue.totalJobsProcessed},${comparison.deltas.queue.jobsProcessedDelta},${comparison.deltas.queue.jobsProcessedPercentChange.toFixed(2)}%`,
    );
    rows.push(
      `Jobs Failed,${comparison.period1.metrics.queue.totalJobsFailed},${comparison.period2.metrics.queue.totalJobsFailed},${comparison.deltas.queue.jobsFailedDelta},${comparison.deltas.queue.jobsFailedPercentChange.toFixed(2)}%`,
    );

    // Improvement Score
    rows.push('');
    rows.push(
      `Overall Improvement,${comparison.improvement.overall},${comparison.improvement.score},,`,
    );
    rows.push(`Latency Score,${comparison.improvement.factors.latency},,,`);
    rows.push(
      `Throughput Score,${comparison.improvement.factors.throughput},,,`,
    );
    rows.push(
      `Error Rate Score,${comparison.improvement.factors.errorRate},,,`,
    );
    rows.push(
      `Reliability Score,${comparison.improvement.factors.reliability},,,`,
    );

    return rows.join('\n');
  }
}
