import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { PaymentService, PaymentIntentDto } from './payment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApplicationsService } from '../applications/applications.service';
import { IsNumber, IsString, IsPositive, IsIn, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';

export class CreatePaymentDto {
  @IsString()
  applicationId: string;

  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  amount: number; // Amount in cents

  @IsString()
  @IsIn(['usd', 'eur', 'gbp']) // Add more currencies as needed
  currency: string;
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly applicationsService: ApplicationsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a payment intent for an application' })
  @ApiBearerAuth()
  @ApiBody({ type: CreatePaymentDto })
  @ApiResponse({ status: 200, description: 'Payment intent created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid token' })
  @ApiResponse({ status: 403, description: 'Forbidden - user does not own the application' })
  async createPaymentIntent(
    @Req() req,
    @Body(ValidationPipe) createPaymentDto: CreatePaymentDto,
  ) {
    // Verify that the application belongs to the current user
    const application = await this.applicationsService.findOne(
      createPaymentDto.applicationId,
      req.user.userId,
    );
    
    if (!application) {
      return { 
        statusCode: HttpStatus.FORBIDDEN, 
        message: 'You do not have permission to create a payment for this application' 
      };
    }
    
    const paymentIntentData: PaymentIntentDto = {
      applicationId: createPaymentDto.applicationId,
      amount: createPaymentDto.amount,
      currency: createPaymentDto.currency,
    };
    
    return this.paymentService.createPaymentIntent(paymentIntentData);
  }

  @Get('confirm/:paymentIntentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a payment by its intent ID' })
  @ApiParam({ name: 'paymentIntentId', description: 'Payment Intent ID', type: String })
  @ApiResponse({ status: 200, description: 'Payment confirmed successfully' })
  @ApiResponse({ status: 404, description: 'Payment intent not found' })
  async confirmPayment(
    @Param('paymentIntentId') paymentIntentId: string,
  ) {
    return this.paymentService.confirmPayment(paymentIntentId);
  }

  @Get(':paymentIntentId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the status of a payment by its intent ID' })
  @ApiParam({ name: 'paymentIntentId', description: 'Payment Intent ID', type: String })
  @ApiResponse({ status: 200, description: 'Payment status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Payment intent not found' })
  async getPaymentStatus(
    @Param('paymentIntentId') paymentIntentId: string,
  ) {
    return this.paymentService.getPaymentStatus(paymentIntentId);
  }

  // Webhook endpoint for payment provider
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle payment webhook events from payment provider' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(@Body() event: any) {
    return this.paymentService.handleWebhook(event);
  }
}