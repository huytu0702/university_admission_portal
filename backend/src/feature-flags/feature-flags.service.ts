import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  async getFlag(flagIdentifier: string): Promise<FeatureFlagDto | null> {
    const flag = await this.prisma.featureFlag.findFirst({
      where: {
        OR: [
          { id: flagIdentifier },
          { name: flagIdentifier },
        ],
      },
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

  async updateFlag(flagIdentifier: string, enabled: boolean): Promise<FeatureFlagDto> {
    const existingFlag = await this.prisma.featureFlag.findFirst({
      where: {
        OR: [
          { id: flagIdentifier },
          { name: flagIdentifier },
        ],
      },
    });

    if (!existingFlag) {
      throw new NotFoundException(`Feature flag '${flagIdentifier}' not found`);
    }

    const flag = await this.prisma.featureFlag.update({
      where: { id: existingFlag.id },
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
