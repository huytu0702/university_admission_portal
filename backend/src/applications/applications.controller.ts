import {
  Controller,
  Post,
  UseGuards,
  Body,
  UploadedFiles,
  UseInterceptors,
  Get,
  Param,
  Request,
  ParseUUIDPipe,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApplicationsService } from './applications.service';
import { ApplicationStatusService } from './application-status.service';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiConsumes, ApiParam } from '@nestjs/swagger';

// DTO for creating an application with validation
export class CreateApplicationDto {
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Personal statement must be at least 10 characters long' })
  @MaxLength(5000, { message: 'Personal statement cannot exceed 5000 characters' })
  @Transform(({ value }) => value?.trim())
  personalStatement?: string;
}

@ApiTags('Applications')
@Controller('applications')
export class ApplicationsController {
  constructor(
    private readonly applicationsService: ApplicationsService,
    private readonly applicationStatusService: ApplicationStatusService,
  ) { }

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FilesInterceptor('files', 5)) // Allow up to 5 files
  @ApiOperation({ summary: 'Create a new application with optional file attachments' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateApplicationDto })
  @ApiResponse({ status: 201, description: 'Application created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid token' })
  @ApiResponse({ status: 413, description: 'Payload too large - file size exceeds limit' })
  async create(
    @Request() req,
    @Body(ValidationPipe) createApplicationDto: CreateApplicationDto,
    @UploadedFiles() files: Array<import('multer').File>,
  ) {
    // Call the service with the DTO and files
    return this.applicationsService.createApplication(req.user.userId, {
      personalStatement: createApplicationDto.personalStatement,
      files,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Get all applications for the authenticated user' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Applications retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid token' })
  async findAll(@Request() req) {
    return this.applicationsService.findAll(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the status of a specific application' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Application ID (UUID)', type: String })
  @ApiResponse({ status: 200, description: 'Application status retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid token' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async getStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Request() req,
  ) {
    // Check that the user owns this application
    const application = await this.applicationsService.findOne(id, req.user.userId);
    if (!application) {
      // If the application doesn't exist or doesn't belong to the user, return 404
      return { statusCode: HttpStatus.NOT_FOUND, message: 'Application not found' };
    }

    return this.applicationStatusService.getApplicationStatus(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/progress')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the progress percentage of a specific application' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Application ID (UUID)', type: String })
  @ApiResponse({ status: 200, description: 'Application progress retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid token' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async getProgress(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Request() req,
  ) {
    // Check that the user owns this application
    const application = await this.applicationsService.findOne(id, req.user.userId);
    if (!application) {
      // If the application doesn't exist or doesn't belong to the user, return 404
      return { statusCode: HttpStatus.NOT_FOUND, message: 'Application not found' };
    }

    const statusInfo = await this.applicationStatusService.getApplicationStatus(id);
    return {
      progress: await this.applicationStatusService.calculateProgressPercentage(id),
      status: statusInfo?.status || 'unknown'
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific application by ID' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Application ID (UUID)', type: String })
  @ApiResponse({ status: 200, description: 'Application retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid token' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Request() req,
  ) {
    return this.applicationsService.findOne(id, req.user.userId);
  }
}