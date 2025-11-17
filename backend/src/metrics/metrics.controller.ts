import {
  Controller,
  Get,
  Query,
  UseGuards,
  Post,
  Body,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrometheusService } from './prometheus.service';
import { MetricsAggregationService } from './metrics-aggregation.service';
import { ComparisonService } from './comparison.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    private prometheusService: PrometheusService,
    private aggregationService: MetricsAggregationService,
    private comparisonService: ComparisonService,
  ) {}

  /**
   * GET /metrics/prometheus
   * Export metrics in Prometheus format
   */
  @Get('prometheus')
  async getPrometheusMetrics() {
    const metrics = await this.prometheusService.getMetrics();
    return metrics;
  }

  /**
   * GET /metrics/aggregated
   * Get aggregated metrics for a time range
   */
  @Get('aggregated')
  @UseGuards(JwtAuthGuard)
  async getAggregatedMetrics(
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const end = endTime ? new Date(endTime) : new Date();
    const start = startTime
      ? new Date(startTime)
      : new Date(end.getTime() - 60 * 60 * 1000); // Default: last hour

    const metrics = await this.aggregationService.aggregateMetrics(start, end);

    return {
      success: true,
      data: metrics,
      timestamp: new Date(),
    };
  }

  /**
   * GET /metrics/snapshots
   * Get metric snapshots within a time range
   */
  @Get('snapshots')
  @UseGuards(JwtAuthGuard)
  getSnapshots(
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const end = endTime ? new Date(endTime) : new Date();
    const start = startTime
      ? new Date(startTime)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000); // Default: last 24 hours

    const snapshots = this.aggregationService.getSnapshots(start, end);

    return {
      success: true,
      data: snapshots,
      count: snapshots.length,
      timestamp: new Date(),
    };
  }

  /**
   * GET /metrics/latest
   * Get the latest metric snapshot
   */
  @Get('latest')
  @UseGuards(JwtAuthGuard)
  getLatestSnapshot() {
    const snapshot = this.aggregationService.getLatestSnapshot();

    return {
      success: true,
      data: snapshot,
      timestamp: new Date(),
    };
  }

  /**
   * GET /metrics/timeseries
   * Get time series data for a specific metric
   */
  @Get('timeseries')
  @UseGuards(JwtAuthGuard)
  getTimeSeries(
    @Query('metricPath') metricPath: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    if (!metricPath) {
      return {
        success: false,
        message: 'metricPath query parameter is required',
      };
    }

    const end = endTime ? new Date(endTime) : new Date();
    const start = startTime
      ? new Date(startTime)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const data = this.aggregationService.getTimeSeriesData(
      metricPath,
      start,
      end,
    );

    return {
      success: true,
      data,
      metricPath,
      timeRange: { start, end },
      timestamp: new Date(),
    };
  }

  /**
   * GET /metrics/compare
   * Compare metrics between two time periods
   */
  @Get('compare')
  @UseGuards(JwtAuthGuard)
  async compareMetrics(
    @Query('period1Start') period1Start: string,
    @Query('period1End') period1End: string,
    @Query('period2Start') period2Start: string,
    @Query('period2End') period2End: string,
  ) {
    if (!period1Start || !period1End || !period2Start || !period2End) {
      return {
        success: false,
        message:
          'All period parameters are required (period1Start, period1End, period2Start, period2End)',
      };
    }

    const comparison = await this.aggregationService.compareMetrics(
      new Date(period1Start),
      new Date(period1End),
      new Date(period2Start),
      new Date(period2End),
    );

    return {
      success: true,
      data: comparison,
      timestamp: new Date(),
    };
  }

  /**
   * POST /metrics/snapshot
   * Manually create a metrics snapshot
   */
  @Post('snapshot')
  @UseGuards(JwtAuthGuard)
  async createSnapshot() {
    const snapshot = await this.aggregationService.createSnapshot();

    return {
      success: true,
      data: snapshot,
      message: 'Snapshot created successfully',
      timestamp: new Date(),
    };
  }

  /**
   * GET /metrics/sampling-rate
   * Calculate appropriate sampling rate based on load
   */
  @Get('sampling-rate')
  @UseGuards(JwtAuthGuard)
  getSamplingRate(
    @Query('currentLoad') currentLoad?: string,
    @Query('maxLoad') maxLoad?: string,
  ) {
    const load = currentLoad ? parseInt(currentLoad, 10) : 100;
    const max = maxLoad ? parseInt(maxLoad, 10) : 1000;

    const samplingRate = this.aggregationService.calculateSamplingRate(
      load,
      max,
    );

    return {
      success: true,
      data: {
        currentLoad: load,
        maxLoad: max,
        samplingRate,
        samplingPercentage: `${(samplingRate * 100).toFixed(1)}%`,
      },
      timestamp: new Date(),
    };
  }

  /**
   * GET /metrics/dashboard
   * Get comprehensive metrics for dashboard display
   */
  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  async getDashboardMetrics(
    @Query('timeRange') timeRange?: string, // '1h', '6h', '24h', '7d'
  ) {
    const now = new Date();
    let startTime: Date;

    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 60 * 60 * 1000); // Default: 1 hour
    }

    const aggregated = await this.aggregationService.aggregateMetrics(
      startTime,
      now,
    );
    const latestSnapshot = this.aggregationService.getLatestSnapshot();

    // Get time series for key metrics
    const timeSeries = {
      latency: this.aggregationService.getTimeSeriesData(
        'http.avgLatency',
        startTime,
        now,
      ),
      throughput: this.aggregationService.getTimeSeriesData(
        'http.totalRequests',
        startTime,
        now,
      ),
      errorRate: this.aggregationService.getTimeSeriesData(
        'http.errorRate',
        startTime,
        now,
      ),
      queueDepth: this.aggregationService.getTimeSeriesData(
        'queue.currentDepth',
        startTime,
        now,
      ),
    };

    return {
      success: true,
      data: {
        aggregated,
        latestSnapshot,
        timeSeries,
        timeRange: {
          label: timeRange || '1h',
          start: startTime,
          end: now,
        },
      },
      timestamp: new Date(),
    };
  }

  /**
   * GET /metrics/health
   * Get metrics system health status
   */
  @Get('health')
  getMetricsHealth() {
    const latestSnapshot = this.aggregationService.getLatestSnapshot();
    const now = new Date();

    let status = 'healthy';
    const issues: string[] = [];

    if (!latestSnapshot) {
      status = 'degraded';
      issues.push('No metric snapshots available');
    } else {
      const timeSinceLastSnapshot =
        now.getTime() - latestSnapshot.timestamp.getTime();
      if (timeSinceLastSnapshot > 10 * 60 * 1000) {
        // More than 10 minutes
        status = 'degraded';
        issues.push(
          `Last snapshot is ${Math.round(timeSinceLastSnapshot / 60000)} minutes old`,
        );
      }
    }

    return {
      success: true,
      status,
      issues,
      lastSnapshot: latestSnapshot?.timestamp || null,
      timestamp: now,
    };
  }

  /**
   * GET /metrics/comparison/detailed
   * Get detailed comparison between two time periods with improvement analysis
   */
  @Get('comparison/detailed')
  @UseGuards(JwtAuthGuard)
  async getDetailedComparison(
    @Query('period1Start') period1Start: string,
    @Query('period1End') period1End: string,
    @Query('period2Start') period2Start: string,
    @Query('period2End') period2End: string,
    @Query('period1Label') period1Label?: string,
    @Query('period2Label') period2Label?: string,
  ) {
    if (!period1Start || !period1End || !period2Start || !period2End) {
      return {
        success: false,
        message:
          'All period parameters are required (period1Start, period1End, period2Start, period2End)',
      };
    }

    const comparison = await this.comparisonService.compareMetricsPeriods(
      new Date(period1Start),
      new Date(period1End),
      new Date(period2Start),
      new Date(period2End),
      period1Label,
      period2Label,
    );

    return {
      success: true,
      data: comparison,
      timestamp: new Date(),
    };
  }

  /**
   * GET /metrics/comparison/pattern-impact
   * Analyze the impact of a specific pattern toggle
   */
  @Get('comparison/pattern-impact')
  @UseGuards(JwtAuthGuard)
  async getPatternImpact(
    @Query('patternName') patternName: string,
    @Query('toggleTime') toggleTime: string,
    @Query('beforeDuration') beforeDuration?: string,
    @Query('afterDuration') afterDuration?: string,
  ) {
    if (!patternName || !toggleTime) {
      return {
        success: false,
        message: 'patternName and toggleTime are required',
      };
    }

    const before = beforeDuration ? parseInt(beforeDuration, 10) : 3600000; // 1 hour
    const after = afterDuration ? parseInt(afterDuration, 10) : 3600000; // 1 hour

    const impact = await this.comparisonService.analyzePatternImpact(
      patternName,
      new Date(toggleTime),
      before,
      after,
    );

    return {
      success: true,
      data: impact,
      timestamp: new Date(),
    };
  }

  /**
   * POST /metrics/comparison/record-toggle
   * Record a pattern toggle event for correlation analysis
   */
  @Post('comparison/record-toggle')
  @UseGuards(JwtAuthGuard)
  recordPatternToggle(
    @Body() body: { patternName: string; enabled: boolean; userId?: string },
  ) {
    if (!body.patternName || body.enabled === undefined) {
      return {
        success: false,
        message: 'patternName and enabled are required',
      };
    }

    this.comparisonService.recordPatternToggle(
      body.patternName,
      body.enabled,
      body.userId,
    );

    return {
      success: true,
      message: 'Pattern toggle recorded',
      timestamp: new Date(),
    };
  }

  /**
   * GET /metrics/comparison/toggle-history
   * Get pattern toggle history for a time range
   */
  @Get('comparison/toggle-history')
  @UseGuards(JwtAuthGuard)
  getToggleHistory(
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const end = endTime ? new Date(endTime) : new Date();
    const start = startTime
      ? new Date(startTime)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const history = this.comparisonService.getPatternToggleHistory(start, end);

    return {
      success: true,
      data: history,
      count: history.length,
      timestamp: new Date(),
    };
  }

  /**
   * GET /metrics/comparison/export/json
   * Export comparison data as JSON
   */
  @Get('comparison/export/json')
  @UseGuards(JwtAuthGuard)
  async exportComparisonJSON(
    @Query('period1Start') period1Start: string,
    @Query('period1End') period1End: string,
    @Query('period2Start') period2Start: string,
    @Query('period2End') period2End: string,
    @Res() res: Response,
  ) {
    if (!period1Start || !period1End || !period2Start || !period2End) {
      return res.status(400).json({
        success: false,
        message:
          'All period parameters are required (period1Start, period1End, period2Start, period2End)',
      });
    }

    const jsonData = await this.comparisonService.exportComparisonJSON(
      new Date(period1Start),
      new Date(period1End),
      new Date(period2Start),
      new Date(period2End),
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="metrics-comparison-${Date.now()}.json"`,
    );
    return res.send(jsonData);
  }

  /**
   * GET /metrics/comparison/export/csv
   * Export comparison data as CSV
   */
  @Get('comparison/export/csv')
  @UseGuards(JwtAuthGuard)
  async exportComparisonCSV(
    @Query('period1Start') period1Start: string,
    @Query('period1End') period1End: string,
    @Query('period2Start') period2Start: string,
    @Query('period2End') period2End: string,
    @Res() res: Response,
  ) {
    if (!period1Start || !period1End || !period2Start || !period2End) {
      return res.status(400).json({
        success: false,
        message:
          'All period parameters are required (period1Start, period1End, period2Start, period2End)',
      });
    }

    const csvData = await this.comparisonService.exportComparisonCSV(
      new Date(period1Start),
      new Date(period1End),
      new Date(period2Start),
      new Date(period2End),
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="metrics-comparison-${Date.now()}.csv"`,
    );
    return res.send(csvData);
  }
}
