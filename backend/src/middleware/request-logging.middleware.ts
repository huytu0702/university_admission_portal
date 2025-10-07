import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    
    // Log the incoming request
    this.logger.log(`${req.method} ${req.url} - ${req.ip}`);

    // Capture the original end method to intercept the response
    const originalEnd = res.end;
    res.end = (...args: [any?, (() => void)?] | [any?, BufferEncoding?, (() => void)?]) => {
      const duration = Date.now() - startTime;
      
      // Log the response
      this.logger.log(
        `${req.method} ${req.url} ${res.statusCode} - ${duration}ms`,
      );
      
      // Call the original end method
      return originalEnd.apply(res, args);
    };

    next();
  }
}