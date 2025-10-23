import { Injectable, Logger } from '@nestjs/common';
import { FeatureFlagsService } from '../feature-flags.service';

@Injectable()
export class BulkheadService {
  private readonly logger = new Logger(BulkheadService.name);
  
  // Store active job counts per bulkhead
  private bulkheadUsage: Map<string, number> = new Map();
  private bulkheadCapacity: Map<string, number> = new Map([
    ['verify_document', 3],    // Document verification bulkhead: max 3 concurrent jobs
    ['create_payment', 2],     // Payment processing bulkhead: max 2 concurrent jobs  
    ['send_email', 5],         // Email sending bulkhead: max 5 concurrent jobs
  ]);

  constructor(
    private featureFlagsService: FeatureFlagsService,
  ) {}

  async executeInBulkhead<T>(
    bulkheadName: string, 
    workFn: () => Promise<T>
  ): Promise<T> {
    // Check if bulkhead isolation feature is enabled
    const flag = await this.featureFlagsService.getFlag('bulkhead-isolation');
    if (!flag || !flag.enabled) {
      // If feature is disabled, execute without bulkhead restrictions
      return await workFn();
    }

    // Check if the requested bulkhead exists
    if (!this.bulkheadCapacity.has(bulkheadName)) {
      this.logger.warn(`Bulkhead ${bulkheadName} not configured, using default capacity`);
      this.bulkheadCapacity.set(bulkheadName, 1); // Default to 1 if not configured
    }

    // Check if there's capacity
    const currentUsage = this.bulkheadUsage.get(bulkheadName) || 0;
    const maxCapacity = this.bulkheadCapacity.get(bulkheadName) || 1;

    if (currentUsage >= maxCapacity) {
      const error = new Error(`Bulkhead ${bulkheadName} is at capacity (${maxCapacity})`);
      this.logger.error(error.message);
      throw error;
    }

    // Increment usage
    this.bulkheadUsage.set(bulkheadName, currentUsage + 1);
    
    // Log the new usage
    this.logger.debug(`Bulkhead ${bulkheadName}: ${currentUsage + 1}/${maxCapacity} active jobs`);

    try {
      // Execute the work
      const result = await workFn();
      return result;
    } finally {
      // Decrement usage when done
      const updatedUsage = Math.max(0, this.bulkheadUsage.get(bulkheadName)! - 1);
      this.bulkheadUsage.set(bulkheadName, updatedUsage);
      
      // Log the updated usage
      this.logger.debug(`Bulkhead ${bulkheadName}: ${updatedUsage}/${maxCapacity} active jobs after completion`);
    }
  }

  getUsageStats(): Map<string, number> {
    return new Map(this.bulkheadUsage);
  }

  getCapacityStats(): Map<string, number> {
    return new Map(this.bulkheadCapacity);
  }
}