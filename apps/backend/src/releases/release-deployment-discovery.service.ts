import { Inject, Injectable, forwardRef } from '@nestjs/common';
import {
  MonitorType,
  ReleaseType,
  type DeploymentDiscoveryMonitorConfig,
} from '@todo-platform/shared-types';
import { MonitorsService } from '../monitors/monitors.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReleasesService } from './releases.service';

const DEFAULT_DEPLOY_CRON = '*/5 * * * *';
const DEFAULT_DISCOVERY_CRON = '*/1 * * * *';

@Injectable()
export class ReleaseDeploymentDiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => MonitorsService))
    private readonly monitorsService: MonitorsService,
    @Inject(forwardRef(() => ReleasesService))
    private readonly releasesService: ReleasesService,
  ) {}

  async maybeStartDiscoveryMonitor(releaseId: string): Promise<void> {
    const release = await this.prisma.release.findUnique({
      where: { id: releaseId },
      include: {
        deployments: true,
        members: { include: { todo: true } },
      },
    });
    if (!release || release.type !== ReleaseType.STAGING) return;

    const snapshot = await this.buildPendingSnapshot(releaseId);
    if (snapshot.pendingServices.length === 0) {
      await this.disableDiscoveryMonitorIfPresent(releaseId);
      return;
    }

    const config: DeploymentDiscoveryMonitorConfig = {
      releaseId,
      releaseCreatedAtMs: release.createdAt.getTime(),
      pendingServices: snapshot.pendingServices,
      skippedServices: snapshot.skippedServices,
    };

    const existing = await this.prisma.monitor.findUnique({ where: { releaseId } });
    if (existing) {
      await this.monitorsService.update(existing.id, {
        type: MonitorType.DEPLOYMENT_DISCOVERY,
        cron: DEFAULT_DISCOVERY_CRON,
        enabled: true,
        config: config as unknown as Record<string, unknown>,
      }, { silent: true });
      return;
    }

    await this.monitorsService.createForRelease(
      releaseId,
      {
        type: MonitorType.DEPLOYMENT_DISCOVERY,
        cron: DEFAULT_DISCOVERY_CRON,
        enabled: true,
        config: config as unknown as Record<string, unknown>,
      },
      { silent: true },
    );
  }

  async attachDiscoveredStagingDeployment(
    releaseId: string,
    serviceId: string,
    jobUrl: string,
    buildNumber: number,
  ): Promise<boolean> {
    const existing = await this.prisma.releaseDeployment.findUnique({
      where: { releaseId_serviceId: { releaseId, serviceId } },
    });
    if (existing?.jobUrl && existing.buildNumber != null) {
      return false;
    }

    const deployment = await this.prisma.releaseDeployment.upsert({
      where: { releaseId_serviceId: { releaseId, serviceId } },
      create: {
        releaseId,
        serviceId,
        environment: ReleaseType.STAGING,
        jobUrl,
        buildNumber,
        status: 'pending',
      },
      update: {
        jobUrl,
        buildNumber,
        status: 'pending',
      },
    });

    await this.monitorsService.createForReleaseDeployment(
      deployment.id,
      {
        type: MonitorType.DEPLOYMENT,
        cron: DEFAULT_DEPLOY_CRON,
        enabled: true,
        config: {
          env: 'staging',
          jobUrl,
          buildNumber,
        },
      },
      { silent: true },
    );

    await this.releasesService.attachTodoDeploymentMonitorsForService(
      releaseId,
      serviceId,
      jobUrl,
      buildNumber,
    );

    await this.releasesService.reaggregateAndBroadcast(releaseId);
    return true;
  }

  async applyDiscoveryPollResult(
    monitorId: string,
    releaseId: string,
    discovered: Array<{ serviceId: string; jobUrl: string; buildNumber: number }>,
  ): Promise<void> {
    for (const entry of discovered) {
      await this.attachDiscoveredStagingDeployment(
        releaseId,
        entry.serviceId,
        entry.jobUrl,
        entry.buildNumber,
      );
    }

    const snapshot = await this.buildPendingSnapshot(releaseId);
    const config: DeploymentDiscoveryMonitorConfig = {
      releaseId,
      releaseCreatedAtMs: (
        await this.prisma.release.findUniqueOrThrow({ where: { id: releaseId } })
      ).createdAt.getTime(),
      pendingServices: snapshot.pendingServices,
      skippedServices: snapshot.skippedServices,
    };

    if (snapshot.pendingServices.length === 0) {
      await this.prisma.monitor.update({
        where: { id: monitorId },
        data: {
          enabled: false,
          nextRunAt: null,
          config: config as unknown as object,
        },
      });
      await this.monitorsService.disableAndUnschedule(monitorId);
      return;
    }

    await this.prisma.monitor.update({
      where: { id: monitorId },
      data: { config: config as unknown as object },
    });
  }

  private async buildPendingSnapshot(releaseId: string): Promise<{
    pendingServices: DeploymentDiscoveryMonitorConfig['pendingServices'];
    skippedServices: NonNullable<DeploymentDiscoveryMonitorConfig['skippedServices']>;
  }> {
    const release = await this.prisma.release.findUnique({
      where: { id: releaseId },
      include: {
        members: { include: { todo: true } },
        deployments: true,
      },
    });
    if (!release) {
      return { pendingServices: [], skippedServices: [] };
    }

    const memberServiceIds = [
      ...new Set(
        release.members
          .map((member) => member.todo.serviceId)
          .filter((id): id is string => id != null),
      ),
    ];

    const completeServiceIds = new Set(
      release.deployments
        .filter((deployment) => deployment.jobUrl && deployment.buildNumber != null)
        .map((deployment) => deployment.serviceId),
    );

    const pendingServices: DeploymentDiscoveryMonitorConfig['pendingServices'] = [];
    const skippedServices: NonNullable<DeploymentDiscoveryMonitorConfig['skippedServices']> =
      [];

    for (const serviceId of memberServiceIds) {
      if (completeServiceIds.has(serviceId)) continue;

      const catalog = await this.prisma.serviceDeployment.findUnique({
        where: {
          serviceId_environment: { serviceId, environment: 'staging' },
        },
      });
      if (!catalog) {
        skippedServices.push({
          serviceId,
          reason: 'No catalog staging job URL configured for service',
        });
        continue;
      }

      pendingServices.push({
        serviceId,
        catalogJobUrl: catalog.jobUrl,
      });
    }

    return { pendingServices, skippedServices };
  }

  private async disableDiscoveryMonitorIfPresent(releaseId: string): Promise<void> {
    const existing = await this.prisma.monitor.findUnique({ where: { releaseId } });
    if (!existing) return;
    await this.monitorsService.disableAndUnschedule(existing.id);
  }
}
