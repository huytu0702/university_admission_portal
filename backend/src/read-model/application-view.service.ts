import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ApplicationView = {
  id: string;
  userId: string;
  status: string;
  progress: number | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class ApplicationViewService {
  private readonly logger = new Logger(ApplicationViewService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getView(applicationId: string, useView = true): Promise<ApplicationView | null> {
    if (useView) {
      const fromView = await this.getFromView(applicationId);
      if (fromView) return fromView;
    }
    return this.getFromSource(applicationId);
  }

  async listForUser(userId: string, useView = true): Promise<ApplicationView[]> {
    if (useView) {
      const fromView = await this.listFromView(userId);
      if (fromView.length) return fromView;
    }
    return this.listFromSource(userId);
  }

  private async getFromView(applicationId: string): Promise<ApplicationView | null> {
    try {
      const rows = await this.prisma.$queryRaw<ApplicationView[]>`
        SELECT id, "userId", status, progress, "createdAt", "updatedAt"
        FROM application_view
        WHERE id = ${applicationId}
        LIMIT 1
      `;
      return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    } catch (err) {
      this.logger.debug(`application_view not available, falling back: ${(err as Error).message}`);
      return null;
    }
  }

  private async listFromView(userId: string): Promise<ApplicationView[]> {
    try {
      const rows = await this.prisma.$queryRaw<ApplicationView[]>`
        SELECT id, "userId", status, progress, "createdAt", "updatedAt"
        FROM application_view
        WHERE "userId" = ${userId}
        ORDER BY "updatedAt" DESC
      `;
      return Array.isArray(rows) ? rows : [];
    } catch (err) {
      this.logger.debug(`application_view list fallback: ${(err as Error).message}`);
      return [];
    }
  }

  private async getFromSource(applicationId: string): Promise<ApplicationView | null> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        userId: true,
        status: true,
        progress: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return application as ApplicationView | null;
  }

  private async listFromSource(userId: string): Promise<ApplicationView[]> {
    const applications = await this.prisma.application.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        status: true,
        progress: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
    return applications as ApplicationView[];
  }
}
