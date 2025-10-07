import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { MetricsService } from '../metrics/metrics.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health & Metrics')
@Controller('health')
export class HealthController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async healthCheck() {
    // Simple health check - in a real application, you might check database connectivity,
    // external services, disk space, etc.
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('metrics/latency')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get endpoint latency metrics' })
  @ApiResponse({ status: 200, description: 'Latency metrics retrieved successfully' })
  async getLatencyMetrics(
    @Query('endpoint') endpoint: string,
    @Query('method') method: string,
    @Query('hours') hours: number = 24,
  ) {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

    const [average, percentiles] = await Promise.all([
      this.metricsService.getAverageLatency(endpoint, method, startTime, endTime),
      this.metricsService.getLatencyPercentiles(endpoint, method, startTime, endTime),
    ]);

    return {
      endpoint,
      method,
      averageLatency: average,
      percentiles,
      period: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
      },
    };
  }

  @Get('metrics/throughput')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get endpoint throughput metrics' })
  @ApiResponse({ status: 200, description: 'Throughput metrics retrieved successfully' })
  async getThroughputMetrics(
    @Query('endpoint') endpoint: string,
    @Query('method') method: string,
    @Query('hours') hours: number = 24,
  ) {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

    const throughput = await this.metricsService.getThroughput(
      endpoint,
      method,
      startTime,
      endTime,
    );

    return {
      endpoint,
      method,
      throughput: `${throughput.toFixed(2)} requests/minute`,
      period: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
      },
    };
  }
}