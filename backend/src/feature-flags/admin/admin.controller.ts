import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FeatureFlagsService } from '../feature-flags.service';

// DTO for updating feature flags
export class UpdateFeatureFlagDto {
  enabled: boolean;
}

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private featureFlagsService: FeatureFlagsService) {}

  @Get('flags')
  @ApiOperation({ summary: 'Get all feature flags and their status' })
  @ApiResponse({ status: 200, description: 'Feature flags retrieved successfully' })
  async getFeatureFlags() {
    return this.featureFlagsService.getAllFlags();
  }

  @Patch('flags/:flagName')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a specific feature flag' })
  @ApiResponse({ status: 200, description: 'Feature flag updated successfully' })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async updateFeatureFlag(
    @Param('flagName') flagName: string,
    @Body() updateDto: UpdateFeatureFlagDto,
  ) {
    return this.featureFlagsService.updateFlag(flagName, updateDto.enabled);
  }
}