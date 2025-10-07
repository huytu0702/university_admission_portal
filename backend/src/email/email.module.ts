import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [EmailService, ConfigService, PrismaService],
  exports: [EmailService],
})
export class EmailModule {}