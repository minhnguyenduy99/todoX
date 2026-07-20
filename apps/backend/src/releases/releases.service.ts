import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ReleaseStatus as PrismaReleaseStatus,
  TodoStatus as PrismaTodoStatus,
  type Prisma,
} from '@prisma/client';
import {
  MonitorType,
  ReleaseType,
  type CreateReleaseDto,
  type ReleaseDto,
  type UpdateReleaseDto,
} from '@todo-platform/shared-types';
import { toReleaseDto, toTodoDto } from '../common/mappers';
import { NON_TERMINAL_RELEASE_STATUSES } from '../common/release-constants';
import { EventsGateway } from '../events/events.gateway';
import { MonitorsService } from '../monitors/monitors.service';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_DEPLOY_CRON = '*/5 * * * *';

const releaseInclude = {
  members: {
    include: {
      todo: { include: { service: true } },
    },
  },
  deployments: {
    include: {
      service: true,
      monitor: true,
    },
  },
  completedTodos: {
    include: { service: true },
  },
} satisfies Prisma.ReleaseInclude;

type ReleaseWithRelations = Prisma.ReleaseGetPayload<{ include: typeof releaseInclude }>;

@Injectable()
export class ReleasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly monitorsService: MonitorsService,
  ) {}

  async findAll(): Promise<ReleaseDto[]> {
    const releases = await this.prisma.release.findMany({
      include: releaseInclude,
      orderBy: [{ releaseDate: 'desc' }, { createdAt: 'desc' }],
    });
    return releases.map(toReleaseDto);
  }

  async findOne(id: string): Promise<ReleaseDto> {
    const release = await this.getReleaseOrThrow(id);
    return toReleaseDto(release);
  }

  async create(dto: CreateReleaseDto): Promise<ReleaseDto> {
    if (!dto.todoIds?.length) {
      throw new BadRequestException('todoIds must be a non-empty list');
    }

    const todos = await this.loadAndValidateTodos(dto.todoIds, dto.type);

    const release = await this.prisma.$transaction(async (tx) => {
      const created = await tx.release.create({
        data: {
          releaseDate: dto.releaseDate,
          content: dto.content,
          type: dto.type,
          status: dto.deployments?.length
            ? PrismaReleaseStatus.in_progress
            : PrismaReleaseStatus.not_started,
        },
      });

      await tx.releaseMember.createMany({
        data: todos.map((todo) => ({
          releaseId: created.id,
          todoId: todo.id,
        })),
      });

      if (dto.deployments?.length) {
        const memberServiceIds = new Set(
          todos.map((t) => t.serviceId).filter((id): id is string => id != null),
        );
        for (const deployment of dto.deployments) {
          const serviceId = await this.resolveDeploymentServiceId(tx, deployment);
          if (!memberServiceIds.has(serviceId)) {
            throw new BadRequestException(
              `Deployment service ${serviceId} is not a member service of this release`,
            );
          }
          await tx.releaseDeployment.create({
            data: {
              releaseId: created.id,
              serviceId,
              environment: dto.type,
              jobUrl: deployment.jobUrl,
              buildNumber: deployment.buildNumber,
              status: 'pending',
            },
          });
        }
      }

      return tx.release.findUniqueOrThrow({
        where: { id: created.id },
        include: releaseInclude,
      });
    });

    if (dto.deployments?.length) {
      const serviceIds = await this.resolveDeploymentServiceIds(dto.deployments);
      await this.startMonitorsForServices(release.id, dto.type, serviceIds);
    }

    const full = await this.getReleaseOrThrow(release.id);
    const result = toReleaseDto(full);
    this.events.broadcast('release.created', result);
    await this.broadcastTodosUpdated(todos.map((t) => t.id));
    return result;
  }

  async update(id: string, dto: UpdateReleaseDto): Promise<ReleaseDto> {
    const existing = await this.getReleaseOrThrow(id);
    const hasMembershipChange =
      (dto.todoIdsToAdd?.length ?? 0) > 0 || (dto.todoIdsToRemove?.length ?? 0) > 0;
    const hasContentChange = dto.content !== undefined;
    const hasDeployments = (dto.deployments?.length ?? 0) > 0;

    if (hasMembershipChange || hasContentChange) {
      if (existing.status !== PrismaReleaseStatus.not_started) {
        throw new ConflictException(
          'Membership and content can only be changed while status is not_started',
        );
      }
    }

    if (!hasMembershipChange && !hasContentChange && !hasDeployments) {
      return toReleaseDto(existing);
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.todoIdsToRemove?.length) {
        const removeIds = [...new Set(dto.todoIdsToRemove)];
        await tx.releaseMember.deleteMany({
          where: { releaseId: id, todoId: { in: removeIds } },
        });
      }

      if (dto.todoIdsToAdd?.length) {
        const addIds = [...new Set(dto.todoIdsToAdd)];
        const todos = await this.loadAndValidateTodos(addIds, existing.type as ReleaseType, {
          tx,
          excludeReleaseId: id,
        });
        await tx.releaseMember.createMany({
          data: todos.map((todo) => ({
            releaseId: id,
            todoId: todo.id,
          })),
          skipDuplicates: true,
        });
      }

      if (hasContentChange) {
        await tx.release.update({
          where: { id },
          data: { content: dto.content },
        });
      }

      if (hasDeployments) {
        const members = await tx.releaseMember.findMany({
          where: { releaseId: id },
          include: { todo: true },
        });
        const memberServiceIds = new Set(
          members
            .map((m) => m.todo.serviceId)
            .filter((serviceId): serviceId is string => serviceId != null),
        );

        for (const deployment of dto.deployments!) {
          const serviceId = await this.resolveDeploymentServiceId(tx, deployment);
          if (!memberServiceIds.has(serviceId)) {
            throw new BadRequestException(
              `Deployment service ${serviceId} is not a member service of this release`,
            );
          }

          const existingDeployment = await tx.releaseDeployment.findUnique({
            where: {
              releaseId_serviceId: { releaseId: id, serviceId },
            },
          });

          if (existingDeployment?.status === 'successful') {
            throw new BadRequestException(
              `Cannot redeploy already-successful service ${serviceId}`,
            );
          }

          await tx.releaseDeployment.upsert({
            where: {
              releaseId_serviceId: { releaseId: id, serviceId },
            },
            create: {
              releaseId: id,
              serviceId,
              environment: existing.type,
              jobUrl: deployment.jobUrl,
              buildNumber: deployment.buildNumber,
              status: 'pending',
            },
            update: {
              jobUrl: deployment.jobUrl,
              buildNumber: deployment.buildNumber,
              status: 'pending',
            },
          });
        }

        await tx.release.update({
          where: { id },
          data: { status: PrismaReleaseStatus.in_progress },
        });
      }

      return tx.release.findUniqueOrThrow({
        where: { id },
        include: releaseInclude,
      });
    });

    if (hasDeployments) {
      const serviceIds = await this.resolveDeploymentServiceIds(dto.deployments!);
      await this.startMonitorsForServices(
        id,
        existing.type as ReleaseType,
        serviceIds,
      );
    }

    const full = await this.getReleaseOrThrow(id);
    const result = toReleaseDto(full);
    this.events.broadcast('release.updated', result);

    const touchedTodoIds = [
      ...(dto.todoIdsToAdd ?? []),
      ...(dto.todoIdsToRemove ?? []),
    ];
    if (touchedTodoIds.length) {
      await this.broadcastTodosUpdated([...new Set(touchedTodoIds)]);
    }

    return result;
  }

  async cancel(id: string): Promise<void> {
    const existing = await this.getReleaseOrThrow(id);
    if (existing.status !== PrismaReleaseStatus.not_started) {
      throw new ConflictException('Only not_started releases can be cancelled');
    }

    const memberTodoIds = existing.members.map((m) => m.todoId);

    await this.prisma.release.delete({ where: { id } });

    this.events.broadcast('release.updated', { id, cancelled: true });
    await this.broadcastTodosUpdated(memberTodoIds);
  }

  private async getReleaseOrThrow(id: string): Promise<ReleaseWithRelations> {
    const release = await this.prisma.release.findUnique({
      where: { id },
      include: releaseInclude,
    });
    if (!release) throw new NotFoundException(`Release ${id} not found`);
    return release;
  }

  private async loadAndValidateTodos(
    todoIds: string[],
    type: ReleaseType,
    options?: {
      tx?: Prisma.TransactionClient;
      excludeReleaseId?: string;
    },
  ) {
    const db = options?.tx ?? this.prisma;
    const uniqueIds = [...new Set(todoIds)];
    const todos = await db.todo.findMany({
      where: { id: { in: uniqueIds } },
      include: {
        service: true,
        releaseMemberships: {
          include: { release: true },
        },
      },
    });

    if (todos.length !== uniqueIds.length) {
      const found = new Set(todos.map((t) => t.id));
      const missing = uniqueIds.filter((id) => !found.has(id));
      throw new BadRequestException(`Todos not found: ${missing.join(', ')}`);
    }

    const requiredStatus =
      type === ReleaseType.STAGING
        ? PrismaTodoStatus.WAIT_FOR_STAGING
        : PrismaTodoStatus.COMPLETED;

    for (const todo of todos) {
      if (!todo.serviceId) {
        throw new BadRequestException(
          `Todo ${todo.id} has no resolvable service and cannot join a release`,
        );
      }

      if (todo.status !== requiredStatus) {
        throw new BadRequestException(
          `Todo ${todo.id} must have status ${requiredStatus} for ${type} releases`,
        );
      }

      const blocking = todo.releaseMemberships.find(
        (membership) =>
          membership.releaseId !== options?.excludeReleaseId &&
          NON_TERMINAL_RELEASE_STATUSES.includes(membership.release.status),
      );
      if (blocking) {
        throw new ConflictException(
          `Todo ${todo.id} is already on non-terminal release ${blocking.releaseId}`,
        );
      }
    }

    return todos;
  }

  private async resolveDeploymentServiceId(
    db: Prisma.TransactionClient | PrismaService,
    deployment: { serviceId?: string; serviceKeyName?: string },
  ): Promise<string> {
    if (deployment.serviceId && deployment.serviceKeyName) {
      const byId = await db.service.findUnique({ where: { id: deployment.serviceId } });
      const byKey = await db.service.findUnique({
        where: { keyName: deployment.serviceKeyName },
      });
      if (!byId) throw new BadRequestException(`Service '${deployment.serviceId}' not found`);
      if (!byKey) {
        throw new BadRequestException(`Service '${deployment.serviceKeyName}' not found`);
      }
      if (byId.id !== byKey.id) {
        throw new BadRequestException(
          'serviceId and serviceKeyName refer to different services',
        );
      }
      return byId.id;
    }

    if (deployment.serviceId) {
      const byId = await db.service.findUnique({ where: { id: deployment.serviceId } });
      if (!byId) throw new BadRequestException(`Service '${deployment.serviceId}' not found`);
      return byId.id;
    }

    if (deployment.serviceKeyName) {
      const byKey = await db.service.findUnique({
        where: { keyName: deployment.serviceKeyName },
      });
      if (!byKey) {
        throw new BadRequestException(`Service '${deployment.serviceKeyName}' not found`);
      }
      return byKey.id;
    }

    throw new BadRequestException('Each deployment requires serviceId or serviceKeyName');
  }

  private async resolveDeploymentServiceIds(
    deployments: Array<{ serviceId?: string; serviceKeyName?: string }>,
  ): Promise<string[]> {
    const ids: string[] = [];
    for (const deployment of deployments) {
      ids.push(await this.resolveDeploymentServiceId(this.prisma, deployment));
    }
    return ids;
  }

  private async startMonitorsForServices(
    releaseId: string,
    environment: ReleaseType,
    serviceIds: string[],
  ): Promise<void> {
    if (!serviceIds.length) return;
    const deployments = await this.prisma.releaseDeployment.findMany({
      where: { releaseId, serviceId: { in: serviceIds } },
    });

    for (const deployment of deployments) {
      if (!deployment.jobUrl || deployment.buildNumber == null) continue;
      await this.monitorsService.createForReleaseDeployment(
        deployment.id,
        {
          type: MonitorType.DEPLOYMENT,
          cron: DEFAULT_DEPLOY_CRON,
          enabled: true,
          config: {
            env: environment === ReleaseType.PROD ? 'prod' : 'staging',
            jobUrl: deployment.jobUrl,
            buildNumber: deployment.buildNumber,
          },
        },
        { silent: true },
      );
    }
  }

  private async broadcastTodosUpdated(todoIds: string[]): Promise<void> {
    if (!todoIds.length) return;
    const todos = await this.prisma.todo.findMany({
      where: { id: { in: todoIds } },
      include: {
        monitor: true,
        service: true,
        subtasks: {
          include: {
            monitor: true,
            pullRequests: true,
            deployedEnvironments: true,
          },
        },
        pullRequests: true,
        associatedTickets: true,
        deployedEnvironments: true,
      },
    });
    for (const todo of todos ?? []) {
      this.events.broadcast('todo.updated', toTodoDto(todo));
    }
  }
}
