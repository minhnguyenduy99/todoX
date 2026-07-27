import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  ReleaseStatus as PrismaReleaseStatus,
  TodoStatus as PrismaTodoStatus,
  type Prisma,
} from '@prisma/client';
import {
  DeployedEnvironmentName,
  MonitorType,
  ReleaseDeploymentStatus,
  ReleaseStatus,
  ReleaseType,
  type CreateReleaseDto,
  type ReleaseDto,
  type UpdateReleaseDto,
} from '@todo-platform/shared-types';
import { addDeployedEnvironmentToTodo } from '../common/deployed-environments';
import { toReleaseDto, toTodoDto } from '../common/mappers';
import { NON_TERMINAL_RELEASE_STATUSES } from '../common/release-constants';
import {
  aggregateReleaseStatus,
  resolveServiceOutcomes,
} from '../common/release-deployment-status-sync';
import {
  assembleTodoChangelogSection,
  extractReleasePreamble,
  mergeReleaseContent,
} from '../common/release-content-assembler';
import { EventsGateway } from '../events/events.gateway';
import { MonitorsService } from '../monitors/monitors.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReleaseDeploymentDiscoveryService } from './release-deployment-discovery.service';

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
    @Inject(forwardRef(() => MonitorsService))
    private readonly monitorsService: MonitorsService,
    @Inject(forwardRef(() => ReleaseDeploymentDiscoveryService))
    private readonly releaseDeploymentDiscovery: ReleaseDeploymentDiscoveryService,
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
    const mergedContent = mergeReleaseContent(
      dto.content,
      assembleTodoChangelogSection(todos),
    );

    const release = await this.prisma.$transaction(async (tx) => {
      const created = await tx.release.create({
        data: {
          releaseDate: dto.releaseDate,
          content: mergedContent,
          type: dto.type,
          status: PrismaReleaseStatus.in_progress,
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

    await this.releaseDeploymentDiscovery.maybeStartDiscoveryMonitor(release.id);

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
    const hasStatusChange = dto.status !== undefined;

    if (hasMembershipChange || hasContentChange) {
      if (existing.deployments.length > 0) {
        throw new ConflictException(
          'Membership and content can only be changed before deployments are attached',
        );
      }
      if (
        existing.status === PrismaReleaseStatus.successful ||
        existing.status === PrismaReleaseStatus.failed
      ) {
        throw new ConflictException(
          'Membership and content cannot be changed on a terminal release',
        );
      }
    }

    if (!hasMembershipChange && !hasContentChange && !hasDeployments && !hasStatusChange) {
      return toReleaseDto(existing);
    }

    if (hasMembershipChange || hasContentChange || hasDeployments) {
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

        if (hasMembershipChange || hasContentChange) {
          const preamble =
            dto.content !== undefined
              ? dto.content
              : extractReleasePreamble(existing.content);
          const members = await tx.releaseMember.findMany({
            where: { releaseId: id },
            include: { todo: { include: { service: true } } },
          });
          const mergedContent = mergeReleaseContent(
            preamble,
            assembleTodoChangelogSection(members.map((member) => member.todo)),
          );
          await tx.release.update({
            where: { id },
            data: { content: mergedContent },
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

        }
      });

      if (hasDeployments) {
        const serviceIds = await this.resolveDeploymentServiceIds(dto.deployments!);
        await this.startMonitorsForServices(
          id,
          existing.type as ReleaseType,
          serviceIds,
        );
        await this.releaseDeploymentDiscovery.maybeStartDiscoveryMonitor(id);
      }
    }

    if (hasStatusChange) {
      await this.applyManualStatus(id, dto.status!);
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

  /** Recompute release status after a member todo changes (plan R9 + todo progress). */
  async recomputeReleasesForTodo(todoId: string): Promise<void> {
    const memberships = await this.prisma.releaseMember.findMany({
      where: { todoId },
      select: { releaseId: true },
    });
    const releaseIds = [...new Set(memberships.map((m) => m.releaseId))];
    for (const releaseId of releaseIds) {
      await this.reaggregateAndBroadcast(releaseId);
    }
  }

  async onDeploymentMonitorResult(
    releaseDeploymentId: string,
    previousStatus: ReleaseDeploymentStatus,
    nextStatus: ReleaseDeploymentStatus,
  ): Promise<void> {
    const deployment = await this.prisma.releaseDeployment.findUnique({
      where: { id: releaseDeploymentId },
      include: { release: true },
    });
    if (!deployment) return;

    await this.prisma.releaseDeployment.update({
      where: { id: releaseDeploymentId },
      data: { status: nextStatus },
    });

    if (
      nextStatus === ReleaseDeploymentStatus.SUCCESSFUL &&
      previousStatus !== ReleaseDeploymentStatus.SUCCESSFUL
    ) {
      if (deployment.release.type === 'staging') {
        await this.completeStagingTodosForService(
          deployment.releaseId,
          deployment.serviceId,
        );
      } else if (deployment.release.type === 'prod') {
        await this.archiveProdTodosForService(
          deployment.releaseId,
          deployment.serviceId,
        );
      }
    }

    await this.reaggregateAndBroadcast(deployment.releaseId);
  }

  private async applyManualStatus(
    releaseId: string,
    status: ReleaseStatus,
  ): Promise<void> {
    const release = await this.getReleaseOrThrow(releaseId);

    if (status === ReleaseStatus.SUCCESSFUL) {
      if (release.type === 'staging') {
        const serviceIds = [
          ...new Set(
            release.members
              .map((m) => m.todo.serviceId)
              .filter((id): id is string => id != null),
          ),
        ];
        for (const serviceId of serviceIds) {
          await this.completeStagingTodosForService(releaseId, serviceId);
        }
      } else {
        const serviceIds = [
          ...new Set(
            release.members
              .map((m) => m.todo.serviceId)
              .filter((id): id is string => id != null),
          ),
        ];
        for (const serviceId of serviceIds) {
          await this.archiveProdTodosForService(releaseId, serviceId);
        }
      }

      await this.prisma.releaseDeployment.updateMany({
        where: { releaseId },
        data: { status: 'successful' },
      });
    }

    await this.prisma.release.update({
      where: { id: releaseId },
      data: { status },
    });
  }

  async completeStagingTodosForService(
    releaseId: string,
    serviceId: string,
  ): Promise<void> {
    const members = await this.prisma.releaseMember.findMany({
      where: { releaseId },
      include: { todo: true },
    });
    const todoIds = members
      .filter((member) => member.todo.serviceId === serviceId)
      .map((member) => member.todoId);

    if (!todoIds.length) return;

    const deployment = await this.prisma.releaseDeployment.findUnique({
      where: { releaseId_serviceId: { releaseId, serviceId } },
      include: { monitor: true },
    });

    if (deployment?.jobUrl && deployment.buildNumber != null) {
      await this.attachTodoDeploymentMonitorsForService(
        releaseId,
        serviceId,
        deployment.jobUrl,
        deployment.buildNumber,
      );
      await this.backfillMemberTodoStagingMonitorFromRelease(deployment);
    } else {
      for (const todoId of todoIds) {
        await addDeployedEnvironmentToTodo(
          this.prisma,
          todoId,
          DeployedEnvironmentName.STAGING,
        );
      }
      await this.broadcastTodosUpdated(todoIds);
    }

    await this.prisma.todo.updateMany({
      where: { id: { in: todoIds } },
      data: { status: 'COMPLETED' },
    });

    await this.broadcastTodosUpdated(todoIds);
  }

  /** Copy release deployment monitor poll results onto member todo staging monitors. */
  private async backfillMemberTodoStagingMonitorFromRelease(
    deployment: Prisma.ReleaseDeploymentGetPayload<{ include: { monitor: true } }>,
  ): Promise<void> {
    const releaseMonitor = deployment.monitor;
    if (!releaseMonitor?.lastResult) return;

    const members = await this.prisma.releaseMember.findMany({
      where: { releaseId: deployment.releaseId },
      include: { todo: true },
    });

    const touchedTodoIds: string[] = [];

    for (const member of members) {
      if (member.todo.serviceId !== deployment.serviceId) continue;

      const todoMonitor = await this.prisma.monitor.findFirst({
        where: { todoId: member.todoId, envKey: 'staging' },
      });
      if (!todoMonitor) continue;

      await this.prisma.monitor.update({
        where: { id: todoMonitor.id },
        data: {
          lastResult: releaseMonitor.lastResult as Prisma.InputJsonValue,
          lastRunAt: releaseMonitor.lastRunAt,
        },
      });
      touchedTodoIds.push(member.todoId);
    }

    if (touchedTodoIds.length) {
      await this.broadcastTodosUpdated(touchedTodoIds);
    }
  }

  async archiveProdTodosForService(
    releaseId: string,
    serviceId: string,
  ): Promise<void> {
    const members = await this.prisma.releaseMember.findMany({
      where: { releaseId },
      include: {
        todo: {
          include: {
            associatedTickets: true,
            pullRequests: true,
          },
        },
      },
    });

    const toArchive = members.filter(
      (member) => member.todo.serviceId === serviceId,
    );

    for (const member of toArchive) {
      const todo = member.todo;
      await this.prisma.$transaction(async (tx) => {
        await tx.completedTodo.create({
          data: {
            originalTodoId: todo.id,
            releaseId,
            title: todo.title,
            description: todo.description,
            changelog: todo.changelog,
            status: todo.status,
            serviceId: todo.serviceId,
            associatedTickets: todo.associatedTickets.map((ticket) => ({
              id: ticket.id,
              title: ticket.title,
              type: ticket.type,
              link: ticket.link,
            })) as Prisma.InputJsonValue,
            pullRequests: todo.pullRequests.map((pr) => ({
              id: pr.id,
              number: pr.number,
              title: pr.title,
              status: pr.status,
              url: pr.url,
            })) as Prisma.InputJsonValue,
            createdAt: todo.createdAt,
            updatedAt: todo.updatedAt,
          },
        });
        await tx.todo.delete({ where: { id: todo.id } });
      });
      this.events.broadcast('todo.deleted', { id: todo.id });
    }
  }

  async reaggregateAndBroadcast(releaseId: string): Promise<ReleaseDto | null> {
    const release = await this.prisma.release.findUnique({
      where: { id: releaseId },
      include: {
        members: { include: { todo: { include: { service: true } } } },
        deployments: { include: { service: true, monitor: true } },
        completedTodos: { include: { service: true } },
      },
    });
    if (!release) return null;

    const memberServiceIds = [
      ...new Set(
        [
          ...release.members
            .map((m) => m.todo.serviceId)
            .filter((id): id is string => id != null),
          ...release.completedTodos
            .map((c) => c.serviceId)
            .filter((id): id is string => id != null),
        ],
      ),
    ];

    const deploymentsByServiceId = new Map(
      release.deployments.map((d) => [
        d.serviceId,
        d.status as ReleaseDeploymentStatus,
      ]),
    );

    const membersByServiceId = new Map<
      string,
      { activeStatuses: string[]; archivedCount: number }
    >();

    for (const member of release.members) {
      if (!member.todo.serviceId) continue;
      const snapshot = membersByServiceId.get(member.todo.serviceId) ?? {
        activeStatuses: [],
        archivedCount: 0,
      };
      snapshot.activeStatuses.push(member.todo.status);
      membersByServiceId.set(member.todo.serviceId, snapshot);
    }

    for (const archived of release.completedTodos) {
      if (!archived.serviceId) continue;
      const snapshot = membersByServiceId.get(archived.serviceId) ?? {
        activeStatuses: [],
        archivedCount: 0,
      };
      snapshot.archivedCount += 1;
      membersByServiceId.set(archived.serviceId, snapshot);
    }

    const outcomes = resolveServiceOutcomes({
      releaseType: release.type as ReleaseType,
      memberServiceIds,
      deploymentsByServiceId,
      membersByServiceId,
    });

    const nextReleaseStatus = aggregateReleaseStatus(memberServiceIds, outcomes);

    const updated = await this.prisma.release.update({
      where: { id: releaseId },
      data: { status: nextReleaseStatus },
      include: releaseInclude,
    });

    const dto = toReleaseDto(updated);
    this.events.broadcast('release.updated', dto);
    return dto;
  }

  async cancel(id: string): Promise<void> {
    const existing = await this.getReleaseOrThrow(id);
    if (existing.deployments.length > 0) {
      throw new ConflictException(
        'Only releases without deployments can be cancelled',
      );
    }
    if (
      existing.status === PrismaReleaseStatus.successful ||
      existing.status === PrismaReleaseStatus.failed
    ) {
      throw new ConflictException('Terminal releases cannot be cancelled');
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

      if (environment === ReleaseType.STAGING) {
        await this.attachTodoDeploymentMonitorsForService(
          releaseId,
          deployment.serviceId,
          deployment.jobUrl,
          deployment.buildNumber,
        );
      }
    }
  }

  /** Attach staging env chips and todo deployment monitors for release member todos (MCP parity). */
  async attachTodoDeploymentMonitorsForService(
    releaseId: string,
    serviceId: string,
    jobUrl: string,
    buildNumber: number,
  ): Promise<void> {
    const members = await this.prisma.releaseMember.findMany({
      where: { releaseId },
      include: { todo: true },
    });

    const monitorPayload = {
      type: MonitorType.DEPLOYMENT,
      cron: DEFAULT_DEPLOY_CRON,
      enabled: true,
      config: {
        env: 'staging' as const,
        jobUrl,
        buildNumber,
        suppressTodoStatusSync: true,
      },
    };

    const touchedTodoIds: string[] = [];

    for (const member of members) {
      if (member.todo.serviceId !== serviceId) continue;

      await addDeployedEnvironmentToTodo(
        this.prisma,
        member.todoId,
        DeployedEnvironmentName.STAGING,
      );

      await this.monitorsService.upsertForTodo(member.todoId, monitorPayload, {
        silent: true,
        clearLastResult: true,
      });

      touchedTodoIds.push(member.todoId);
    }

    await this.broadcastTodosUpdated(touchedTodoIds);
  }

  private async broadcastTodosUpdated(todoIds: string[]): Promise<void> {
    if (!todoIds.length) return;
    const todos = await this.prisma.todo.findMany({
      where: { id: { in: todoIds } },
      include: {
        monitors: true,
        service: true,
        subtasks: {
          include: {
            monitors: true,
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
