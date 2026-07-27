import { Injectable, NotFoundException } from '@nestjs/common';
import type { Notification } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  NotificationKind,
  type DeploymentMonitorConfig,
  type NotificationDto,
  type NotificationUpdatedPayload,
} from '@todo-platform/shared-types';
import { EventsGateway } from '../events/events.gateway';
import { PrismaService } from '../prisma/prisma.service';
import type { TerminalOutcome } from '../common/notification-transitions';

const NOTIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  async findRecent(): Promise<NotificationDto[]> {
    await this.purgeExpired();
    const cutoff = new Date(Date.now() - NOTIFICATION_TTL_MS);
    const rows = await this.prisma.notification.findMany({
      where: { createdAt: { gte: cutoff } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toNotificationDto);
  }

  async markRead(id: string): Promise<NotificationDto> {
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Notification ${id} not found`);
    }
    const row = await this.prisma.notification.update({
      where: { id },
      data: { readAt: existing.readAt ?? new Date() },
    });
    const dto = toNotificationDto(row);
    this.events.broadcast('notification.updated', {
      notification: dto,
    } satisfies NotificationUpdatedPayload);
    return dto;
  }

  async markAllRead(): Promise<void> {
    const cutoff = new Date(Date.now() - NOTIFICATION_TTL_MS);
    await this.prisma.notification.updateMany({
      where: { readAt: null, createdAt: { gte: cutoff } },
      data: { readAt: new Date() },
    });
    this.events.broadcast('notification.updated', {
      readAll: true,
    } satisfies NotificationUpdatedPayload);
  }

  async create(params: {
    kind: NotificationKind;
    title: string;
    body?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<NotificationDto> {
    const row = await this.prisma.notification.create({
      data: {
        kind: params.kind,
        title: params.title,
        body: params.body ?? null,
        payload: (params.payload ?? {}) as Prisma.InputJsonValue,
      },
    });
    const dto = toNotificationDto(row);
    this.events.broadcast('notification.created', dto);
    return dto;
  }

  async createForTodoDeployment(params: {
    todoId: string;
    todoTitle: string;
    env: string;
    buildNumber?: number;
    buildUrl?: string;
    outcome: TerminalOutcome;
  }): Promise<NotificationDto> {
    const verb = params.outcome === 'success' ? 'completed' : 'failed';
    const buildLabel = params.buildNumber != null ? ` #${params.buildNumber}` : '';
    return this.create({
      kind: NotificationKind.TODO_DEPLOYMENT,
      title: `Deployment ${verb}: ${params.todoTitle}`,
      body: `${params.env}${buildLabel} deployment ${verb}.`,
      payload: {
        todoId: params.todoId,
        env: params.env,
        buildNumber: params.buildNumber ?? null,
        buildUrl: params.buildUrl ?? null,
        outcome: params.outcome,
      },
    });
  }

  async createForSubtaskDeployment(params: {
    subtaskId: string;
    subtaskName: string;
    todoId: string;
    todoTitle: string;
    env: string;
    buildNumber?: number;
    buildUrl?: string;
    outcome: TerminalOutcome;
  }): Promise<NotificationDto> {
    const verb = params.outcome === 'success' ? 'completed' : 'failed';
    const buildLabel = params.buildNumber != null ? ` #${params.buildNumber}` : '';
    return this.create({
      kind: NotificationKind.SUBTASK_DEPLOYMENT,
      title: `Subtask deployment ${verb}: ${params.subtaskName}`,
      body: `${params.env}${buildLabel} on "${params.todoTitle}" ${verb}.`,
      payload: {
        subtaskId: params.subtaskId,
        todoId: params.todoId,
        env: params.env,
        buildNumber: params.buildNumber ?? null,
        buildUrl: params.buildUrl ?? null,
        outcome: params.outcome,
      },
    });
  }

  async createForReleaseDeployment(params: {
    releaseId: string;
    releaseDate: string;
    serviceKeyName: string;
    environment: string;
    buildNumber?: number | null;
    buildUrl?: string | null;
    outcome: TerminalOutcome;
  }): Promise<NotificationDto> {
    const verb = params.outcome === 'success' ? 'completed' : 'failed';
    const buildLabel = params.buildNumber != null ? ` #${params.buildNumber}` : '';
    return this.create({
      kind: NotificationKind.RELEASE_DEPLOYMENT,
      title: `Release deployment ${verb}: ${params.serviceKeyName}`,
      body: `${params.releaseDate} ${params.environment}${buildLabel} ${verb}.`,
      payload: {
        releaseId: params.releaseId,
        serviceKeyName: params.serviceKeyName,
        environment: params.environment,
        buildNumber: params.buildNumber ?? null,
        buildUrl: params.buildUrl ?? null,
        outcome: params.outcome,
      },
    });
  }

  async createForTestcaseScan(params: {
    scanId: string;
    scanName: string;
    todoId: string;
    todoTitle: string;
    buildUrl?: string | null;
    outcome: TerminalOutcome;
  }): Promise<NotificationDto> {
    const verb = params.outcome === 'success' ? 'completed' : 'failed';
    return this.create({
      kind: NotificationKind.TESTCASE_SCAN,
      title: `Test scan ${verb}: ${params.scanName}`,
      body: `"${params.scanName}" on "${params.todoTitle}" ${verb}.`,
      payload: {
        scanId: params.scanId,
        todoId: params.todoId,
        buildUrl: params.buildUrl ?? null,
        outcome: params.outcome,
      },
    });
  }

  private async purgeExpired(): Promise<void> {
    const cutoff = new Date(Date.now() - NOTIFICATION_TTL_MS);
    await this.prisma.notification.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
  }
}

function toNotificationDto(row: Notification): NotificationDto {
  return {
    id: row.id,
    kind: row.kind as NotificationKind,
    title: row.title,
    body: row.body,
    payload: (row.payload as Record<string, unknown>) ?? {},
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function deploymentMetaFromConfigAndResult(
  config: unknown,
  result: { metadata?: Record<string, unknown> },
): { env: string; buildNumber?: number; buildUrl?: string } {
  const cfg = config as DeploymentMonitorConfig | null | undefined;
  const deployment = result.metadata?.deployment as
    | { buildUrl?: string; buildNumber?: number }
    | undefined;
  return {
    env: cfg?.env ?? 'unknown',
    buildNumber: cfg?.buildNumber ?? deployment?.buildNumber,
    buildUrl: deployment?.buildUrl,
  };
}

export { deploymentMetaFromConfigAndResult };
