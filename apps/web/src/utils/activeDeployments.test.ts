import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DeployedEnvironmentDto, SubtaskDto, TodoDto } from '@todo-platform/shared-types';
import {
  DeployedEnvironmentName,
  DeploymentStatus,
  SubtaskStatus,
  TodoStatus,
} from '@todo-platform/shared-types';
import {
  collectTodayServiceDeployments,
  formatDeploymentGroupCopyText,
  groupTodayDeploymentsByEnvironment,
  isDeploymentToday,
  startOfLocalDayMs,
} from './activeDeployments';

const baseService = (
  overrides: Partial<{ id: string; keyName: string; displayName: string }> = {},
) => ({
  id: 's1',
  keyName: 'billing-api',
  displayName: 'Billing',
  deployments: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const baseTodo = (overrides: Partial<TodoDto> = {}): TodoDto => ({
  id: 'todo-1',
  title: 'Test',
  description: null,
  changelog: null,
  status: TodoStatus.NOT_STARTED,
  statusUpdateDate: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const env = (overrides: Partial<DeployedEnvironmentDto>): DeployedEnvironmentDto => ({
  id: 'env-default',
  name: DeployedEnvironmentName.DEV,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const subtask = (overrides: Partial<SubtaskDto> = {}): SubtaskDto => ({
  id: 'sub-1',
  todoId: 'todo-1',
  name: 'Deploy',
  status: SubtaskStatus.IN_PROGRESS,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('isDeploymentToday', () => {
  it('matches deployments on the same local calendar day', () => {
    const now = new Date(2026, 6, 24, 15, 30).getTime();
    const morning = new Date(2026, 6, 24, 8, 0).getTime();
    const yesterday = new Date(2026, 6, 23, 23, 59).getTime();

    assert.equal(isDeploymentToday(morning, now), true);
    assert.equal(isDeploymentToday(yesterday, now), false);
    assert.equal(isDeploymentToday(startOfLocalDayMs(now), now), true);
  });
});

describe('collectTodayServiceDeployments', () => {
  const now = new Date(2026, 6, 24, 15, 30).getTime();
  const todayTs = new Date(2026, 6, 24, 10, 0).getTime();
  const earlierTodayTs = new Date(2026, 6, 24, 8, 0).getTime();
  const yesterdayTs = new Date(2026, 6, 23, 20, 0).getTime();

  it('includes deployments from today with any status', () => {
    const todos = [
      baseTodo({
        service: baseService(),
        deployedEnvironments: [
          env({
            name: DeployedEnvironmentName.UAT,
            deployment: {
              env: DeployedEnvironmentName.UAT,
              jobName: 'billing-uat',
              buildNumber: 42,
              durationMs: 120_000,
              status: DeploymentStatus.SUCCESS,
              timestamp: todayTs,
              buildUrl: 'https://jenkins.example/job/billing-uat/42/',
            },
          }),
        ],
      }),
    ];

    const rows = collectTodayServiceDeployments(todos, now);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.status, DeploymentStatus.SUCCESS);
    assert.equal(rows[0]?.buildNumber, 42);
  });

  it('maps currentStep from deployment metadata', () => {
    const todos = [
      baseTodo({
        service: baseService(),
        deployedEnvironments: [
          env({
            name: DeployedEnvironmentName.DEV,
            deployment: {
              env: DeployedEnvironmentName.DEV,
              jobName: 'billing-dev',
              buildNumber: 7,
              durationMs: null,
              status: DeploymentStatus.IN_PROGRESS,
              currentStep: 'Deploy',
              timestamp: todayTs,
            },
          }),
        ],
      }),
    ];

    const rows = collectTodayServiceDeployments(todos, now);
    assert.equal(rows[0]?.currentStep, 'Deploy');
  });

  it('excludes deployments from before today', () => {
    const todos = [
      baseTodo({
        service: baseService(),
        deployedEnvironments: [
          env({
            deployment: {
              env: DeployedEnvironmentName.DEV,
              jobName: 'billing-dev',
              buildNumber: 10,
              durationMs: 1000,
              status: DeploymentStatus.SUCCESS,
              timestamp: yesterdayTs,
            },
          }),
        ],
      }),
    ];

    assert.equal(collectTodayServiceDeployments(todos, now).length, 0);
  });

  it('keeps both dev and uat deployments for the same service today', () => {
    const todos = [
      baseTodo({
        service: baseService(),
        deployedEnvironments: [
          env({
            id: 'env-old',
            name: DeployedEnvironmentName.DEV,
            deployment: {
              env: DeployedEnvironmentName.DEV,
              jobName: 'billing-dev',
              buildNumber: 10,
              durationMs: 1000,
              status: DeploymentStatus.SUCCESS,
              timestamp: earlierTodayTs,
            },
          }),
          env({
            id: 'env-new',
            name: DeployedEnvironmentName.UAT,
            deployment: {
              env: DeployedEnvironmentName.UAT,
              jobName: 'billing-uat',
              buildNumber: 42,
              durationMs: null,
              status: DeploymentStatus.IN_PROGRESS,
              timestamp: todayTs,
            },
          }),
        ],
      }),
    ];

    const rows = collectTodayServiceDeployments(todos, now);
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((row) => row.environment).sort(),
      [DeployedEnvironmentName.DEV, DeployedEnvironmentName.UAT],
    );
  });

  it('returns one row per service', () => {
    const todos = [
      baseTodo({
        id: 'todo-1',
        service: baseService({ keyName: 'billing-api', displayName: 'Billing' }),
        deployedEnvironments: [
          env({
            id: 'env-billing',
            name: DeployedEnvironmentName.UAT,
            deployment: {
              env: DeployedEnvironmentName.UAT,
              jobName: 'billing-uat',
              buildNumber: 1,
              durationMs: 1000,
              status: DeploymentStatus.SUCCESS,
              timestamp: todayTs,
            },
          }),
        ],
      }),
      baseTodo({
        id: 'todo-2',
        service: baseService({ id: 's2', keyName: 'auth-api', displayName: 'Auth' }),
        deployedEnvironments: [
          env({
            id: 'env-auth',
            name: DeployedEnvironmentName.DEV,
            deployment: {
              env: DeployedEnvironmentName.DEV,
              jobName: 'auth-dev',
              buildNumber: 2,
              durationMs: 1000,
              status: DeploymentStatus.FAIL,
              timestamp: todayTs,
            },
          }),
        ],
      }),
    ];

    const rows = collectTodayServiceDeployments(todos, now);
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((row) => row.serviceLabel).sort(),
      ['Auth', 'Billing'],
    );
  });

  it('inherits parent service for subtask deployments', () => {
    const todos = [
      baseTodo({
        service: baseService({ displayName: 'Auth', keyName: 'auth-api', id: 's2' }),
        subtasks: [
          subtask({
            deployedEnvironments: [
              env({
                name: DeployedEnvironmentName.DEV,
                deployment: {
                  env: DeployedEnvironmentName.DEV,
                  jobName: 'auth-dev',
                  buildNumber: 7,
                  durationMs: null,
                  status: DeploymentStatus.IN_PROGRESS,
                  timestamp: todayTs,
                },
              }),
            ],
          }),
        ],
      }),
    ];

    const rows = collectTodayServiceDeployments(todos, now);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.serviceLabel, 'Auth');
  });

  it('uses Unassigned when todo has no service', () => {
    const todos = [
      baseTodo({
        service: null,
        deployedEnvironments: [
          env({
            name: DeployedEnvironmentName.STAGING,
            deployment: {
              env: DeployedEnvironmentName.STAGING,
              jobName: 'staging',
              buildNumber: 1,
              durationMs: null,
              status: DeploymentStatus.IN_PROGRESS,
              timestamp: todayTs,
            },
          }),
        ],
      }),
    ];

    assert.equal(collectTodayServiceDeployments(todos, now)[0]?.serviceLabel, 'Unassigned');
  });

  it('deduplicates the same build across multiple todos for one service row', () => {
    const deployment = {
      env: DeployedEnvironmentName.UAT,
      jobName: 'billing-uat',
      buildNumber: 42,
      durationMs: null,
      status: DeploymentStatus.IN_PROGRESS,
      timestamp: todayTs,
      buildUrl: 'https://jenkins.example/job/billing-uat/42/',
    };

    const todos = [
      baseTodo({
        id: 'todo-1',
        service: baseService(),
        deployedEnvironments: [env({ id: 'env-1', name: DeployedEnvironmentName.UAT, deployment })],
      }),
      baseTodo({
        id: 'todo-2',
        service: baseService(),
        deployedEnvironments: [env({ id: 'env-2', name: DeployedEnvironmentName.UAT, deployment })],
      }),
    ];

    assert.equal(collectTodayServiceDeployments(todos, now).length, 1);
  });

  it('returns empty list for empty todos', () => {
    assert.deepEqual(collectTodayServiceDeployments([], now), []);
  });
});

describe('groupTodayDeploymentsByEnvironment', () => {
  const now = new Date(2026, 6, 24, 15, 30).getTime();
  const todayTs = new Date(2026, 6, 24, 10, 0).getTime();
  const earlierTodayTs = new Date(2026, 6, 24, 8, 0).getTime();

  it('groups multiple services under the same environment', () => {
    const rows = collectTodayServiceDeployments(
      [
        baseTodo({
          service: baseService({ keyName: 'billing-api', displayName: 'Billing' }),
          deployedEnvironments: [
            env({
              id: 'env-billing',
              name: DeployedEnvironmentName.UAT,
              deployment: {
                env: DeployedEnvironmentName.UAT,
                jobName: 'billing-uat',
                buildNumber: 1,
                durationMs: 1000,
                status: DeploymentStatus.SUCCESS,
                timestamp: todayTs,
              },
            }),
          ],
        }),
        baseTodo({
          id: 'todo-2',
          service: baseService({ id: 's2', keyName: 'auth-api', displayName: 'Auth' }),
          deployedEnvironments: [
            env({
              id: 'env-auth',
              name: DeployedEnvironmentName.UAT,
              deployment: {
                env: DeployedEnvironmentName.UAT,
                jobName: 'auth-uat',
                buildNumber: 2,
                durationMs: 1000,
                status: DeploymentStatus.SUCCESS,
                timestamp: earlierTodayTs,
              },
            }),
          ],
        }),
      ],
      now,
    );

    const groups = groupTodayDeploymentsByEnvironment(rows);
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.environment, DeployedEnvironmentName.UAT);
    assert.deepEqual(
      groups[0]?.deployments.map((row) => row.serviceLabel).sort(),
      ['Auth', 'Billing'],
    );
  });

  it('sorts env groups by catalog order', () => {
    const rows = collectTodayServiceDeployments(
      [
        baseTodo({
          service: baseService(),
          deployedEnvironments: [
            env({
              id: 'env-staging',
              name: DeployedEnvironmentName.STAGING,
              deployment: {
                env: DeployedEnvironmentName.STAGING,
                jobName: 'billing-staging',
                buildNumber: 3,
                durationMs: 1000,
                status: DeploymentStatus.SUCCESS,
                timestamp: todayTs,
              },
            }),
            env({
              id: 'env-dev',
              name: DeployedEnvironmentName.DEV,
              deployment: {
                env: DeployedEnvironmentName.DEV,
                jobName: 'billing-dev',
                buildNumber: 1,
                durationMs: 1000,
                status: DeploymentStatus.SUCCESS,
                timestamp: earlierTodayTs,
              },
            }),
          ],
        }),
      ],
      now,
    );

    const groups = groupTodayDeploymentsByEnvironment(rows);
    assert.deepEqual(
      groups.map((group) => group.environment),
      [DeployedEnvironmentName.DEV, DeployedEnvironmentName.STAGING],
    );
  });

  it('sorts deployments within an env group newest-first', () => {
    const rows = collectTodayServiceDeployments(
      [
        baseTodo({
          service: baseService({ keyName: 'billing-api', displayName: 'Billing' }),
          deployedEnvironments: [
            env({
              id: 'env-billing',
              name: DeployedEnvironmentName.UAT,
              deployment: {
                env: DeployedEnvironmentName.UAT,
                jobName: 'billing-uat',
                buildNumber: 1,
                durationMs: 1000,
                status: DeploymentStatus.SUCCESS,
                timestamp: earlierTodayTs,
              },
            }),
          ],
        }),
        baseTodo({
          id: 'todo-2',
          service: baseService({ id: 's2', keyName: 'auth-api', displayName: 'Auth' }),
          deployedEnvironments: [
            env({
              id: 'env-auth',
              name: DeployedEnvironmentName.UAT,
              deployment: {
                env: DeployedEnvironmentName.UAT,
                jobName: 'auth-uat',
                buildNumber: 2,
                durationMs: 1000,
                status: DeploymentStatus.SUCCESS,
                timestamp: todayTs,
              },
            }),
          ],
        }),
      ],
      now,
    );

    const groups = groupTodayDeploymentsByEnvironment(rows);
    assert.deepEqual(groups[0]?.deployments.map((row) => row.serviceLabel), ['Auth', 'Billing']);
  });
});

describe('formatDeploymentGroupCopyText', () => {
  const now = new Date(2026, 6, 24, 15, 30).getTime();
  const todayTs = new Date(2026, 6, 24, 10, 0).getTime();

  it('includes only in-progress deployments with build URLs', () => {
    const rows = collectTodayServiceDeployments(
      [
        baseTodo({
          service: baseService(),
          deployedEnvironments: [
            env({
              name: DeployedEnvironmentName.UAT,
              deployment: {
                env: DeployedEnvironmentName.UAT,
                jobName: 'billing-uat',
                buildNumber: 42,
                durationMs: 120_000,
                status: DeploymentStatus.SUCCESS,
                timestamp: todayTs,
                buildUrl: 'https://jenkins.example/job/billing-uat/42/',
              },
            }),
            env({
              id: 'env-dev',
              name: DeployedEnvironmentName.DEV,
              deployment: {
                env: DeployedEnvironmentName.DEV,
                jobName: 'billing-dev',
                buildNumber: 7,
                durationMs: null,
                status: DeploymentStatus.IN_PROGRESS,
                timestamp: todayTs,
                buildUrl: 'https://jenkins.example/job/billing-dev/7/',
              },
            }),
          ],
        }),
      ],
      now,
    );

    const text = formatDeploymentGroupCopyText(rows);
    assert.equal(
      text,
      'Billing - https://jenkins.example/blue/organizations/jenkins/billing-dev/detail/billing-dev/7/pipeline',
    );
  });

  it('excludes in-progress deployments without a resolvable Blue Ocean link', () => {
    const rows = collectTodayServiceDeployments(
      [
        baseTodo({
          service: baseService(),
          deployedEnvironments: [
            env({
              name: DeployedEnvironmentName.DEV,
              deployment: {
                env: DeployedEnvironmentName.DEV,
                jobName: 'billing-dev',
                buildNumber: 7,
                durationMs: null,
                status: DeploymentStatus.IN_PROGRESS,
                currentStep: 'Deploy',
                timestamp: todayTs,
              },
            }),
          ],
        }),
      ],
      now,
    );

    assert.equal(formatDeploymentGroupCopyText(rows), '');
  });

  it('joins multiple in-progress deployments with newlines', () => {
    const rows = collectTodayServiceDeployments(
      [
        baseTodo({
          service: baseService({ keyName: 'billing-api', displayName: 'Billing' }),
          deployedEnvironments: [
            env({
              id: 'env-billing',
              name: DeployedEnvironmentName.UAT,
              deployment: {
                env: DeployedEnvironmentName.UAT,
                jobName: 'billing-uat',
                buildNumber: 1,
                durationMs: null,
                status: DeploymentStatus.IN_PROGRESS,
                timestamp: todayTs,
                buildUrl: 'https://jenkins.example/job/billing-uat/1/',
              },
            }),
          ],
        }),
        baseTodo({
          id: 'todo-2',
          service: baseService({ id: 's2', keyName: 'auth-api', displayName: 'Auth' }),
          deployedEnvironments: [
            env({
              id: 'env-auth',
              name: DeployedEnvironmentName.DEV,
              deployment: {
                env: DeployedEnvironmentName.DEV,
                jobName: 'auth-dev',
                buildNumber: 2,
                durationMs: null,
                status: DeploymentStatus.IN_PROGRESS,
                timestamp: todayTs,
                buildUrl: 'https://jenkins.example/job/auth-dev/2/',
              },
            }),
          ],
        }),
      ],
      now,
    );

    const text = formatDeploymentGroupCopyText(rows);
    assert.equal(
      text,
      [
        'Billing - https://jenkins.example/blue/organizations/jenkins/billing-uat/detail/billing-uat/1/pipeline',
        'Auth - https://jenkins.example/blue/organizations/jenkins/auth-dev/detail/auth-dev/2/pipeline',
      ].join('\n'),
    );
  });
});
