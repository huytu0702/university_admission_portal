import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from '../metrics/metrics.service';
import { PrometheusService } from '../metrics/prometheus.service';
import { MetricsAggregationService } from '../metrics/metrics-aggregation.service';

@Injectable()
export class MetricsCollectionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(MetricsCollectionMiddleware.name);

  constructor(
    private metricsService: MetricsService,
    private prometheusService: PrometheusService,
    private aggregationService: MetricsAggregationService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    
    // Capture the original end method to intercept the response
    const originalEnd = res.end;
    res.end = (...args: [any?, (() => void)?] | [any?, BufferEncoding?, (() => void)?]) => {
      const duration = Date.now() - startTime;
      const durationSeconds = duration / 1000;
      
      // Get sampling rate based on current load (mock implementation)
      const currentLoad = 100; // Would be calculated from system metrics
      const maxLoad = 1000;
      const samplingRate = this.aggregationService.calculateSamplingRate(currentLoad, maxLoad);

      // Only record metrics if sampling allows
      if (this.aggregationService.shouldSample(samplingRate)) {
        // Record to database (existing functionality)
        this.metricsService.recordLatency({
          endpoint: req.path,
          method: req.method,
          latency: duration,
          timestamp: new Date(),
        }).catch(error => {
          this.logger.error('Failed to record metric', error);
        });

        // Record to Prometheus
        this.prometheusService.recordHttpRequest(
          req.method,
          req.route?.path || req.path,
          res.statusCode,
          durationSeconds,
        );

        // Record errors if status code indicates error
        if (res.statusCode >= 400) {
          const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
          this.prometheusService.recordHttpError(
            req.method,
            req.route?.path || req.path,
            errorType,
          );
        }
      }
      
      // Call the original end method
      return originalEnd.apply(res, args);
    };

    next();
  }
}