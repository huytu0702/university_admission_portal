import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Post,
  Delete,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { FeatureFlagsService } from '../feature-flags.service';
import { DlqService } from '../workers/dlq.service';

// DTO for updating feature flags
export class UpdateFeatureFlagDto {
  @IsBoolean()
  enabled: boolean;
}

// DTO for requeuing DLQ jobs
export class RequeueJobDto {
  queueName: string;
  jobId: string;
}

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(
    private featureFlagsService: FeatureFlagsService,
    private dlqService: DlqService,
  ) {}

  @Get('flags')
  @ApiOperation({ summary: 'Get all feature flags and their status' })
  @ApiResponse({ status: 200, description: 'Feature flags retrieved successfully' })
  async getFeatureFlags() {
    return this.featureFlagsService.getAllFlags();
  }

  @Patch('flags/:flagIdentifier')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a specific feature flag' })
  @ApiResponse({ status: 200, description: 'Feature flag updated successfully' })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async updateFeatureFlag(
    @Param('flagIdentifier') flagIdentifier: string,
    @Body(ValidationPipe) updateDto: UpdateFeatureFlagDto,
  ) {
    return this.featureFlagsService.updateFlag(flagIdentifier, updateDto.enabled);
  }

  @Get('dlq/:queueName')
  @ApiOperation({ summary: 'Get all failed jobs in DLQ for a specific queue' })
  @ApiResponse({ status: 200, description: 'Failed jobs retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Invalid queue name' })
  async getDlqJobs(@Param('queueName') queueName: string) {
    return await this.dlqService.getFailedJobs(queueName);
  }

  @Post('dlq/requeue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Requeue a specific job from DLQ' })
  @ApiResponse({ status: 200, description: 'Job requeued successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async requeueJob(@Body() requeueDto: RequeueJobDto) {
    const success = await this.dlqService.requeueJob(requeueDto.queueName, requeueDto.jobId);
    if (success) {
      return { status: 'success', message: `Job ${requeueDto.jobId} requeued successfully` };
    } else {
      return { status: 'error', message: `Failed to requeue job ${requeueDto.jobId}` };
    }
  }

  @Delete('dlq/:queueName')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Purge all failed jobs in DLQ for a specific queue' })
  @ApiResponse({ status: 200, description: 'Failed jobs purged successfully' })
  @ApiResponse({ status: 404, description: 'Invalid queue name' })
  async purgeDlqJobs(@Param('queueName') queueName: string) {
    const purgedCount = await this.dlqService.purgeFailedJobs(queueName);
    return { purgedCount, message: `Purged ${purgedCount} jobs from ${queueName} DLQ` };
  }

  @Get('dlq/metrics')
  @ApiOperation({ summary: 'Get DLQ metrics for all queues' })
  @ApiResponse({ status: 200, description: 'DLQ metrics retrieved successfully' })
  async getDlqMetrics() {
    return await this.dlqService.getDlqMetrics();
  }
}
