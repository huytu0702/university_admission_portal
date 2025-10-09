import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export type FeatureFlagDto = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  updatedAt: Date;
};

@Injectable()
export class FeatureFlagsService {
  constructor(private prisma: PrismaService) {}

  async getAllFlags(): Promise<FeatureFlagDto[]> {
    const flags = await this.prisma.featureFlag.findMany();
    return flags.map(flag => ({
      id: flag.id,
      name: flag.name,
      description: flag.description,
      enabled: flag.enabled,
      updatedAt: flag.updatedAt,
    }));
  }

  async getFlag(flagName: string): Promise<FeatureFlagDto | null> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { name: flagName },
    });
    
    if (!flag) return null;
    
    return {
      id: flag.id,
      name: flag.name,
      description: flag.description,
      enabled: flag.enabled,
      updatedAt: flag.updatedAt,
    };
  }

  async updateFlag(flagName: string, enabled: boolean): Promise<FeatureFlagDto> {
    const flag = await this.prisma.featureFlag.update({
      where: { name: flagName },
      data: { 
        enabled, 
        updatedAt: new Date() 
      },
    });
    
    return {
      id: flag.id,
      name: flag.name,
      description: flag.description,
      enabled: flag.enabled,
      updatedAt: flag.updatedAt,
    };
  }
}