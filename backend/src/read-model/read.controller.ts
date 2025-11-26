import { BadRequestException, Controller, Get, MessageEvent, Param, Post, Query, Sse } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Observable, map } from 'rxjs';
import { ApplicationReadService } from './application-read.service';
import { ApplicationStatusStream } from './status-updates.gateway';

@ApiTags('Read-Model')
@Controller('read')
export class ReadController {
  constructor(
    private readonly readService: ApplicationReadService,
    private readonly statusStream: ApplicationStatusStream,
  ) {}

  @Get('applications/:id')
  @ApiOperation({ summary: 'Cache-aside read for a single application' })
  @ApiResponse({ status: 200, description: 'Application read successfully' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async getApplication(@Param('id') id: string) {
    return this.readService.getById(id);
  }

  @Get('applications')
  @ApiOperation({ summary: 'Cache-aside read list for a user (CQRS-lite view)' })
  @ApiResponse({ status: 200, description: 'Application list read successfully' })
  async listForUser(@Query('userId') userId?: string) {
    if (!userId) {
      throw new BadRequestException('userId query param is required');
    }
    return this.readService.listForUser(userId);
  }

  @Post('applications/:id/refresh')
  @ApiOperation({ summary: 'Refresh cache and read-model for a single application' })
  @ApiResponse({ status: 200, description: 'Cache refreshed successfully' })
  async refresh(@Param('id') id: string) {
    return this.readService.refresh(id);
  }

  @Sse('applications/stream')
  @ApiOperation({ summary: 'Real-time status updates for application reads' })
  stream(): Observable<MessageEvent> {
    return this.statusStream.stream().pipe(
      map((event) => ({
        data: event,
      })),
    );
  }
}
