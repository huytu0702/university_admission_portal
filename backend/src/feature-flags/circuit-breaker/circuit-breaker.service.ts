import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags.service';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number;  // Number of failures before opening circuit
  timeout: number;           // Time in ms to keep circuit open
  resetTimeout: number;      // Time in ms to try resetting after opening
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  
  // Store circuit state for each service/operation
  private circuits: Map<string, {
    state: CircuitState;
    failureCount: number;
    lastFailureTime: number | null;
  }> = new Map();

  constructor(
    private prisma: PrismaService,
    private featureFlagsService: FeatureFlagsService,
  ) {}

  async executeWithCircuitBreaker<T>(
    circuitName: string,
    operation: () => Promise<T>,
    config: CircuitBreakerConfig
  ): Promise<T> {
    // Check if the circuit breaker feature is enabled
    const flag = await this.featureFlagsService.getFlag('circuit-breaker-payment');
    if (!flag || !flag.enabled) {
      // If feature is disabled, execute operation directly without circuit breaker
      return await operation();
    }

    // Get or initialize the circuit state
    if (!this.circuits.has(circuitName)) {
      this.circuits.set(circuitName, {
        state: CircuitState.CLOSED,
        failureCount: 0,
        lastFailureTime: null,
      });
    }

    const circuit = this.circuits.get(circuitName)!;

    // Check if circuit is open
    if (circuit.state === CircuitState.OPEN) {
      // Check if enough time has passed to try resetting
      if (circuit.lastFailureTime && 
          Date.now() - circuit.lastFailureTime >= config.resetTimeout) {
        this.logger.log(`Circuit ${circuitName} transitioning to HALF_OPEN`);
        circuit.state = CircuitState.HALF_OPEN;
      } else {
        this.logger.warn(`Circuit ${circuitName} is OPEN - request blocked`);
        throw new Error(`Circuit breaker for ${circuitName} is OPEN - request blocked`);
      }
    }

    try {
      // Execute the operation
      const result = await operation();
      
      // Success - reset circuit if it was in half-open state
      if (circuit.state === CircuitState.HALF_OPEN) {
        this.onSuccess(circuitName, circuit, config);
      }
      
      return result;
    } catch (error) {
      this.onFailure(circuitName, circuit, config);
      throw error;
    }
  }

  private onSuccess(circuitName: string, circuit: any, config: CircuitBreakerConfig): void {
    this.logger.log(`Circuit ${circuitName} operation succeeded`);
    circuit.failureCount = 0;
    circuit.state = CircuitState.CLOSED;
    circuit.lastFailureTime = null;
  }

  private onFailure(circuitName: string, circuit: any, config: CircuitBreakerConfig): void {
    this.logger.log(`Circuit ${circuitName} operation failed`);
    circuit.failureCount++;

    if (circuit.failureCount >= config.failureThreshold) {
      this.logger.log(`Circuit ${circuitName} OPENING after ${circuit.failureCount} failures`);
      circuit.state = CircuitState.OPEN;
      circuit.lastFailureTime = Date.now();
    }
  }

  getState(circuitName: string): CircuitState | null {
    const circuit = this.circuits.get(circuitName);
    return circuit ? circuit.state : null;
  }

  getMetrics(circuitName: string): { state: CircuitState, failureCount: number } | null {
    const circuit = this.circuits.get(circuitName);
    return circuit ? {
      state: circuit.state,
      failureCount: circuit.failureCount,
    } : null;
  }
}