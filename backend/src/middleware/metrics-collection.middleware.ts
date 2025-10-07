import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class MetricsCollectionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(MetricsCollectionMiddleware.name);

  constructor(private metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    
    // Capture the original end method to intercept the response
    const originalEnd = res.end;
    res.end = (...args: [any?, (() => void)?] | [any?, BufferEncoding?, (() => void)?]) => {
      const duration = Date.now() - startTime;
      
      // Record the metric
      this.metricsService.recordLatency({
        endpoint: req.path,
        method: req.method,
        latency: duration,
        timestamp: new Date(),
        // In a real application, you would extract the user ID from the request
        // For now, we'll leave it undefined
      }).catch(error => {
        this.logger.error('Failed to record metric', error);
      });
      
      // Call the original end method
      return originalEnd.apply(res, args);
    };

    next();
  }
}