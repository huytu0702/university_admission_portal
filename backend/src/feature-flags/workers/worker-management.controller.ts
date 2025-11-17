import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { WorkerScalingService } from './worker-scaling.service';
import { WorkerPoolService } from './worker-pool.service';
import {
  WorkerLoadBalancerService,
  LoadBalancingStrategy,
} from './worker-load-balancer.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('admin/workers')
@UseGuards(JwtAuthGuard)
export class WorkerManagementController {
  constructor(
    private workerScalingService: WorkerScalingService,
    private workerPoolService: WorkerPoolService,
    private loadBalancerService: WorkerLoadBalancerService,
  ) {}

  // ==================== Worker Scaling Endpoints ====================

  /**
   * GET /admin/workers/scaling/metrics
   * Get scaling metrics for all queues
   */
  @Get('scaling/metrics')
  async getAllScalingMetrics() {
    const metrics = await this.workerScalingService.getAllScalingMetrics();
    return {
      success: true,
      data: metrics,
      timestamp: new Date(),
    };
  }

  /**
   * GET /admin/workers/scaling/metrics/:queueName
   * Get scaling metrics for a specific queue
   */
  @Get('scaling/metrics/:queueName')
  async getScalingMetrics(@Param('queueName') queueName: string) {
    const metrics =
      await this.workerScalingService.getScalingMetrics(queueName);

    if (!metrics) {
      return {
        success: false,
        message: `Queue '${queueName}' not found`,
      };
    }

    return {
      success: true,
      data: metrics,
      timestamp: new Date(),
    };
  }

  /**
   * GET /admin/workers/scaling/config
   * Get all scaling configurations
   */
  @Get('scaling/config')
  getAllScalingConfigs() {
    const configs = this.workerScalingService.getAllScalingConfigs();
    return {
      success: true,
      data: Array.from(configs.values()),
      timestamp: new Date(),
    };
  }

  /**
   * GET /admin/workers/scaling/config/:queueName
   * Get scaling configuration for a specific queue
   */
  @Get('scaling/config/:queueName')
  getScalingConfig(@Param('queueName') queueName: string) {
    const config = this.workerScalingService.getScalingConfig(queueName);

    if (!config) {
      return {
        success: false,
        message: `Queue '${queueName}' not found`,
      };
    }

    return {
      success: true,
      data: config,
      timestamp: new Date(),
    };
  }

  /**
   * PATCH /admin/workers/scaling/config/:queueName
   * Update scaling configuration
   */
  @Patch('scaling/config/:queueName')
  updateScalingConfig(
    @Param('queueName') queueName: string,
    @Body()
    updates: {
      minWorkers?: number;
      maxWorkers?: number;
      scaleUpThreshold?: number;
      scaleDownThreshold?: number;
      checkInterval?: number;
      cooldownPeriod?: number;
    },
  ) {
    try {
      this.workerScalingService.updateScalingConfig(queueName, updates);
      return {
        success: true,
        message: `Scaling config updated for '${queueName}'`,
        data: this.workerScalingService.getScalingConfig(queueName),
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * POST /admin/workers/scaling/manual/:queueName
   * Manually set worker count
   */
  @Post('scaling/manual/:queueName')
  setWorkerCount(
    @Param('queueName') queueName: string,
    @Body('count') count: number,
  ) {
    try {
      this.workerScalingService.setWorkerCount(queueName, count);
      return {
        success: true,
        message: `Worker count set to ${count} for '${queueName}'`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==================== Worker Pool Endpoints ====================

  /**
   * GET /admin/workers/pools
   * Get all pool definitions
   */
  @Get('pools')
  getAllPools() {
    const pools = this.workerPoolService.getAllPoolDefinitions();
    return {
      success: true,
      data: pools,
      timestamp: new Date(),
    };
  }

  /**
   * GET /admin/workers/pools/:poolId
   * Get specific pool definition
   */
  @Get('pools/:poolId')
  getPool(@Param('poolId') poolId: string) {
    const pool = this.workerPoolService.getPoolDefinition(poolId);

    if (!pool) {
      return {
        success: false,
        message: `Pool '${poolId}' not found`,
      };
    }

    return {
      success: true,
      data: pool,
      timestamp: new Date(),
    };
  }

  /**
   * GET /admin/workers/pools/stats/all
   * Get statistics for all pools
   */
  @Get('pools/stats/all')
  async getAllPoolStats() {
    const stats = await this.workerPoolService.getAllPoolStats();
    return {
      success: true,
      data: stats,
      timestamp: new Date(),
    };
  }

  /**
   * GET /admin/workers/pools/:poolId/stats
   * Get statistics for a specific pool
   */
  @Get('pools/:poolId/stats')
  async getPoolStats(@Param('poolId') poolId: string) {
    const stats = await this.workerPoolService.getPoolStats(poolId);

    if (!stats) {
      return {
        success: false,
        message: `Pool '${poolId}' not found`,
      };
    }

    return {
      success: true,
      data: stats,
      timestamp: new Date(),
    };
  }

  /**
   * GET /admin/workers/pools/health/all
   * Get health status for all pools
   */
  @Get('pools/health/all')
  async getAllPoolHealth() {
    const health = await this.workerPoolService.getAllPoolHealth();
    return {
      success: true,
      data: health,
      timestamp: new Date(),
    };
  }

  /**
   * GET /admin/workers/pools/:poolId/health
   * Get health status for a specific pool
   */
  @Get('pools/:poolId/health')
  async getPoolHealth(@Param('poolId') poolId: string) {
    const health = await this.workerPoolService.getPoolHealth(poolId);

    if (!health) {
      return {
        success: false,
        message: `Pool '${poolId}' not found`,
      };
    }

    return {
      success: true,
      data: health,
      timestamp: new Date(),
    };
  }

  /**
   * PATCH /admin/workers/pools/:poolId/config
   * Update pool configuration
   */
  @Patch('pools/:poolId/config')
  updatePoolConfig(
    @Param('poolId') poolId: string,
    @Body()
    updates: {
      poolName?: string;
      description?: string;
      concurrency?: number;
      priority?: number;
      enabled?: boolean;
    },
  ) {
    try {
      const updated = this.workerPoolService.updatePoolConfig(poolId, updates);
      return {
        success: true,
        message: `Pool config updated for '${poolId}'`,
        data: updated,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * POST /admin/workers/pools/:poolId/pause
   * Pause a pool
   */
  @Post('pools/:poolId/pause')
  async pausePool(@Param('poolId') poolId: string) {
    try {
      await this.workerPoolService.pausePool(poolId);
      return {
        success: true,
        message: `Pool '${poolId}' paused`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * POST /admin/workers/pools/:poolId/resume
   * Resume a paused pool
   */
  @Post('pools/:poolId/resume')
  async resumePool(@Param('poolId') poolId: string) {
    try {
      await this.workerPoolService.resumePool(poolId);
      return {
        success: true,
        message: `Pool '${poolId}' resumed`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * POST /admin/workers/pools/:poolId/clean
   * Clean completed jobs from pool
   */
  @Post('pools/:poolId/clean')
  async cleanPool(
    @Param('poolId') poolId: string,
    @Body('grace') grace?: number,
  ) {
    try {
      const count = await this.workerPoolService.cleanPool(poolId, grace);
      return {
        success: true,
        message: `Cleaned ${count} jobs from pool '${poolId}'`,
        data: { cleanedCount: count },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * POST /admin/workers/pools/:poolId/enable
   * Enable a pool
   */
  @Post('pools/:poolId/enable')
  async enablePool(@Param('poolId') poolId: string) {
    try {
      await this.workerPoolService.setPoolEnabled(poolId, true);
      return {
        success: true,
        message: `Pool '${poolId}' enabled`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * POST /admin/workers/pools/:poolId/disable
   * Disable a pool
   */
  @Post('pools/:poolId/disable')
  async disablePool(@Param('poolId') poolId: string) {
    try {
      await this.workerPoolService.setPoolEnabled(poolId, false);
      return {
        success: true,
        message: `Pool '${poolId}' disabled`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * GET /admin/workers/dashboard
   * Get comprehensive dashboard data
   */
  @Get('dashboard')
  async getDashboard() {
    const [scalingMetrics, poolStats, poolHealth] = await Promise.all([
      this.workerScalingService.getAllScalingMetrics(),
      this.workerPoolService.getAllPoolStats(),
      this.workerPoolService.getAllPoolHealth(),
    ]);

    return {
      success: true,
      data: {
        scaling: scalingMetrics,
        pools: poolStats,
        health: poolHealth,
      },
      timestamp: new Date(),
    };
  }

  // ==================== Load Balancing Endpoints ====================

  /**
   * GET /admin/workers/load-balancer/strategy
   * Get current load balancing strategy
   */
  @Get('load-balancer/strategy')
  getLoadBalancingStrategy() {
    const strategy = this.loadBalancerService.getStrategy();
    return {
      success: true,
      data: { strategy },
      timestamp: new Date(),
    };
  }

  /**
   * POST /admin/workers/load-balancer/strategy
   * Change load balancing strategy
   */
  @Post('load-balancer/strategy')
  setLoadBalancingStrategy(@Body('strategy') strategy: LoadBalancingStrategy) {
    try {
      this.loadBalancerService.setStrategy(strategy);
      return {
        success: true,
        message: `Load balancing strategy changed to '${strategy}'`,
        data: { strategy },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * GET /admin/workers/load-balancer/nodes
   * Get all worker nodes
   */
  @Get('load-balancer/nodes')
  getAllWorkerNodes() {
    const nodes = this.loadBalancerService.getAllWorkerNodes();
    const result: Record<string, any[]> = {};

    nodes.forEach((workers, queueName) => {
      result[queueName] = workers;
    });

    return {
      success: true,
      data: result,
      timestamp: new Date(),
    };
  }

  /**
   * GET /admin/workers/load-balancer/nodes/:queueName
   * Get worker nodes for a specific queue
   */
  @Get('load-balancer/nodes/:queueName')
  getWorkerNodes(@Param('queueName') queueName: string) {
    const nodes = this.loadBalancerService.getWorkerNodes(queueName);
    return {
      success: true,
      data: nodes,
      timestamp: new Date(),
    };
  }

  /**
   * GET /admin/workers/load-balancer/metrics
   * Get load balancing metrics for all queues
   */
  @Get('load-balancer/metrics')
  getAllLoadBalancingMetrics() {
    const metrics = this.loadBalancerService.getAllMetrics();
    const result: Record<string, any> = {};

    metrics.forEach((metric, queueName) => {
      result[queueName] = {
        ...metric,
        distributionMap: Object.fromEntries(metric.distributionMap),
      };
    });

    return {
      success: true,
      data: result,
      timestamp: new Date(),
    };
  }

  /**
   * GET /admin/workers/load-balancer/metrics/:queueName
   * Get load balancing metrics for a specific queue
   */
  @Get('load-balancer/metrics/:queueName')
  getLoadBalancingMetrics(@Param('queueName') queueName: string) {
    const metrics = this.loadBalancerService.getMetrics(queueName);

    if (!metrics) {
      return {
        success: false,
        message: `Queue '${queueName}' not found`,
      };
    }

    return {
      success: true,
      data: {
        ...metrics,
        distributionMap: Object.fromEntries(metrics.distributionMap),
      },
      timestamp: new Date(),
    };
  }

  /**
   * POST /admin/workers/load-balancer/nodes/:queueName/:workerId/health
   * Set worker health status
   */
  @Post('load-balancer/nodes/:queueName/:workerId/health')
  setWorkerHealth(
    @Param('queueName') queueName: string,
    @Param('workerId') workerId: string,
    @Body('healthy') healthy: boolean,
  ) {
    try {
      this.loadBalancerService.setWorkerHealth(queueName, workerId, healthy);
      return {
        success: true,
        message: `Worker '${workerId}' set to ${healthy ? 'healthy' : 'unhealthy'}`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * POST /admin/workers/load-balancer/nodes/:queueName/:workerId/weight
   * Set worker weight
   */
  @Post('load-balancer/nodes/:queueName/:workerId/weight')
  setWorkerWeight(
    @Param('queueName') queueName: string,
    @Param('workerId') workerId: string,
    @Body('weight') weight: number,
  ) {
    try {
      this.loadBalancerService.setWorkerWeight(queueName, workerId, weight);
      return {
        success: true,
        message: `Worker '${workerId}' weight updated to ${weight}`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * POST /admin/workers/load-balancer/nodes/:queueName/add
   * Add a new worker node
   */
  @Post('load-balancer/nodes/:queueName/add')
  addWorkerNode(
    @Param('queueName') queueName: string,
    @Body('workerId') workerId: string,
    @Body('weight') weight?: number,
  ) {
    try {
      this.loadBalancerService.addWorkerNode(queueName, workerId, weight);
      return {
        success: true,
        message: `Worker '${workerId}' added to queue '${queueName}'`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * POST /admin/workers/load-balancer/nodes/:queueName/:workerId/remove
   * Remove a worker node
   */
  @Post('load-balancer/nodes/:queueName/:workerId/remove')
  removeWorkerNode(
    @Param('queueName') queueName: string,
    @Param('workerId') workerId: string,
  ) {
    try {
      this.loadBalancerService.removeWorkerNode(queueName, workerId);
      return {
        success: true,
        message: `Worker '${workerId}' removed from queue '${queueName}'`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * POST /admin/workers/load-balancer/metrics/:queueName/reset
   * Reset load balancing metrics
   */
  @Post('load-balancer/metrics/:queueName/reset')
  resetLoadBalancingMetrics(@Param('queueName') queueName: string) {
    try {
      this.loadBalancerService.resetMetrics(queueName);
      return {
        success: true,
        message: `Metrics reset for queue '${queueName}'`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
