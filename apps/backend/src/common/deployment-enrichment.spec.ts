import {
  DeployedEnvironmentName,
  DeploymentStatus,
  MonitorResultStatus,
  MonitorType,
  type DeploymentInfo,
  type MonitorDto,
} from '@todo-platform/shared-types';
import type { DeployedEnvironment } from '@prisma/client';
import {
  collectDeploymentMonitors,
  enrichDeployedEnvironments,
  extractDeploymentInfo,
} from './deployment-enrichment';

describe('deployment-enrichment', () => {
  const baseEnv: DeployedEnvironment = {
    id: 'env-1',
    name: 'dev',
    todoId: 'todo-1',
    subtaskId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const deployment: DeploymentInfo = {
    env: DeployedEnvironmentName.DEV,
    jobName: 'my-job',
    buildNumber: 100,
    durationMs: 5000,
    status: DeploymentStatus.IN_PROGRESS,
  };

  function makeMonitor(overrides: Partial<MonitorDto> = {}): MonitorDto {
    return {
      id: 'mon-1',
      todoId: null,
      subtaskId: 'sub-1',
      releaseDeploymentId: null,
      testcaseScanId: null,
      type: MonitorType.DEPLOYMENT,
      cron: '*/1 * * * *',
      enabled: true,
      config: { env: 'dev', jobUrl: 'https://jenkins/job/my-job', buildNumber: 100 },
      lastRunAt: '2026-01-02T00:00:00.000Z',
      nextRunAt: null,
      lastResult: {
        status: MonitorResultStatus.RUNNING,
        message: 'in progress',
        metadata: { deployment },
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      ...overrides,
    } as MonitorDto;
  }

  describe('extractDeploymentInfo', () => {
    it('returns deployment from metadata', () => {
      expect(
        extractDeploymentInfo({
          status: MonitorResultStatus.RUNNING,
          message: 'ok',
          metadata: { deployment },
        }),
      ).toEqual(deployment);
    });

    it('returns undefined when metadata is missing', () => {
      expect(extractDeploymentInfo({ status: MonitorResultStatus.RUNNING, message: 'ok' })).toBeUndefined();
    });
  });

  describe('enrichDeployedEnvironments', () => {
    const toBaseDto = (env: DeployedEnvironment) => ({
      id: env.id,
      name: DeployedEnvironmentName.DEV,
      createdAt: env.createdAt.toISOString(),
      updatedAt: env.updatedAt.toISOString(),
    });

    it('attaches deployment when monitor env matches chip', () => {
      const result = enrichDeployedEnvironments([baseEnv], [makeMonitor()], toBaseDto);
      expect(result[0].deployment).toEqual(deployment);
    });

    it('leaves chip without deployment when no matching monitor', () => {
      const result = enrichDeployedEnvironments([baseEnv], [], toBaseDto);
      expect(result[0].deployment).toBeUndefined();
    });

    it('ignores non-deployment monitors', () => {
      const result = enrichDeployedEnvironments(
        [baseEnv],
        [makeMonitor({ type: MonitorType.HTTP })],
        toBaseDto,
      );
      expect(result[0].deployment).toBeUndefined();
    });

    it('matches chip by monitor config env, not lastResult env', () => {
      const result = enrichDeployedEnvironments(
        [baseEnv],
        [
          makeMonitor({
            config: { env: 'dev', jobUrl: 'https://jenkins/job/my-job', buildNumber: 100 },
            lastResult: {
              status: MonitorResultStatus.RUNNING,
              message: 'in progress',
              metadata: {
                deployment: { ...deployment, env: DeployedEnvironmentName.UAT },
              },
            },
          }),
        ],
        toBaseDto,
      );
      expect(result[0].deployment).toBeDefined();
    });

    it('picks monitor with latest lastRunAt for same env', () => {
      const older = makeMonitor({
        id: 'mon-old',
        lastRunAt: '2026-01-01T00:00:00.000Z',
        lastResult: {
          status: MonitorResultStatus.RUNNING,
          message: 'old',
          metadata: {
            deployment: { ...deployment, buildNumber: 1 },
          },
        },
      });
      const newer = makeMonitor({
        id: 'mon-new',
        lastRunAt: '2026-01-03T00:00:00.000Z',
        lastResult: {
          status: MonitorResultStatus.SUCCESS,
          message: 'new',
          metadata: {
            deployment: { ...deployment, buildNumber: 2, status: DeploymentStatus.SUCCESS },
          },
        },
      });

      const result = enrichDeployedEnvironments([baseEnv], [older, newer], toBaseDto);
      expect(result[0].deployment?.buildNumber).toBe(2);
    });

    it('prefers todo monitor over older subtask monitor for same env', () => {
      const todoMonitor = makeMonitor({
        id: 'mon-todo',
        todoId: 'todo-1',
        subtaskId: null,
        lastRunAt: '2026-01-03T00:00:00.000Z',
        lastResult: {
          status: MonitorResultStatus.SUCCESS,
          message: 'todo',
          metadata: {
            deployment: { ...deployment, buildNumber: 99, status: DeploymentStatus.SUCCESS },
          },
        },
      });
      const subtaskMonitor = makeMonitor({
        id: 'mon-sub',
        lastRunAt: '2026-01-01T00:00:00.000Z',
        lastResult: {
          status: MonitorResultStatus.RUNNING,
          message: 'sub',
          metadata: {
            deployment: { ...deployment, buildNumber: 1 },
          },
        },
      });

      const result = enrichDeployedEnvironments(
        [baseEnv],
        [subtaskMonitor, todoMonitor],
        toBaseDto,
      );
      expect(result[0].deployment?.buildNumber).toBe(99);
    });

    it('enriches dev and uat chips from separate todo monitors', () => {
      const devEnv: DeployedEnvironment = { ...baseEnv, id: 'env-dev', name: 'dev' };
      const uatEnv: DeployedEnvironment = { ...baseEnv, id: 'env-uat', name: 'uat' };
      const toDto = (env: DeployedEnvironment) => ({
        id: env.id,
        name:
          env.name === 'uat'
            ? DeployedEnvironmentName.UAT
            : DeployedEnvironmentName.DEV,
        createdAt: env.createdAt.toISOString(),
        updatedAt: env.updatedAt.toISOString(),
      });

      const devMonitor = makeMonitor({
        id: 'mon-dev',
        todoId: 'todo-1',
        subtaskId: null,
        config: { env: 'dev', jobUrl: 'https://jenkins/job/dev', buildNumber: 10 },
        lastResult: {
          status: MonitorResultStatus.RUNNING,
          message: 'dev',
          metadata: {
            deployment: { ...deployment, env: DeployedEnvironmentName.DEV, buildNumber: 10 },
          },
        },
      });
      const uatMonitor = makeMonitor({
        id: 'mon-uat',
        todoId: 'todo-1',
        subtaskId: null,
        config: { env: 'uat', jobUrl: 'https://jenkins/job/uat', buildNumber: 20 },
        lastResult: {
          status: MonitorResultStatus.RUNNING,
          message: 'uat',
          metadata: {
            deployment: {
              ...deployment,
              env: DeployedEnvironmentName.UAT,
              buildNumber: 20,
            },
          },
        },
      });

      const result = enrichDeployedEnvironments(
        [devEnv, uatEnv],
        [devMonitor, uatMonitor],
        toDto,
      );

      expect(result.find((env) => env.name === DeployedEnvironmentName.DEV)?.deployment?.buildNumber).toBe(10);
      expect(result.find((env) => env.name === DeployedEnvironmentName.UAT)?.deployment?.buildNumber).toBe(20);
    });
  });

  describe('collectDeploymentMonitors', () => {
    it('filters null monitors', () => {
      expect(collectDeploymentMonitors([null, makeMonitor(), undefined])).toHaveLength(1);
    });
  });
});
