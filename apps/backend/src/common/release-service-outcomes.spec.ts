import { ReleaseDeploymentStatus } from '@todo-platform/shared-types';
import { classifyReleaseServiceOutcomes } from './release-service-outcomes';

describe('classifyReleaseServiceOutcomes', () => {
  const svcA = 'svc-a';
  const svcB = 'svc-b';

  it('marks service A successful and B movable when A deployment succeeded', () => {
    const result = classifyReleaseServiceOutcomes({
      type: 'staging',
      members: [
        { todoId: 'todo-a', todo: { serviceId: svcA, status: 'COMPLETED' } },
        { todoId: 'todo-b', todo: { serviceId: svcB, status: 'WAIT_FOR_STAGING' } },
      ],
      deployments: [
        { serviceId: svcA, status: ReleaseDeploymentStatus.SUCCESSFUL },
        { serviceId: svcB, status: ReleaseDeploymentStatus.PENDING },
      ],
      completedTodos: [],
    });

    expect(result.successfulServiceIds).toEqual([svcA]);
    expect(result.nonSuccessfulServiceIds).toEqual([svcB]);
    expect(result.movableTodoIds).toEqual(['todo-b']);
    expect(result.hasAnySuccessfulService).toBe(true);
  });

  it('treats all-COMPLETED staging todos as successful even when deployment is running', () => {
    const result = classifyReleaseServiceOutcomes({
      type: 'staging',
      members: [
        { todoId: 'todo-a', todo: { serviceId: svcA, status: 'COMPLETED' } },
        { todoId: 'todo-b', todo: { serviceId: svcB, status: 'WAIT_FOR_STAGING' } },
      ],
      deployments: [
        { serviceId: svcA, status: ReleaseDeploymentStatus.IN_PROGRESS },
        { serviceId: svcB, status: ReleaseDeploymentStatus.PENDING },
      ],
      completedTodos: [],
    });

    expect(result.successfulServiceIds).toEqual([svcA]);
    expect(result.movableTodoIds).toEqual(['todo-b']);
  });

  it('treats prod archived service as successful and remaining active todos as movable', () => {
    const result = classifyReleaseServiceOutcomes({
      type: 'prod',
      members: [
        { todoId: 'todo-b', todo: { serviceId: svcB, status: 'COMPLETED' } },
      ],
      deployments: [
        { serviceId: svcA, status: ReleaseDeploymentStatus.SUCCESSFUL },
        { serviceId: svcB, status: ReleaseDeploymentStatus.FAILED },
      ],
      completedTodos: [{ serviceId: svcA }],
    });

    expect(result.successfulServiceIds).toEqual([svcA]);
    expect(result.nonSuccessfulServiceIds).toEqual([svcB]);
    expect(result.movableTodoIds).toEqual(['todo-b']);
  });

  it('marks all todos movable when no deployments and no successes', () => {
    const result = classifyReleaseServiceOutcomes({
      type: 'staging',
      members: [
        { todoId: 'todo-a', todo: { serviceId: svcA, status: 'WAIT_FOR_STAGING' } },
        { todoId: 'todo-b', todo: { serviceId: svcB, status: 'WAIT_FOR_STAGING' } },
      ],
      deployments: [],
      completedTodos: [],
    });

    expect(result.successfulServiceIds).toEqual([]);
    expect(result.movableTodoIds.sort()).toEqual(['todo-a', 'todo-b']);
    expect(result.hasAnySuccessfulService).toBe(false);
  });

  it('returns empty movable set when all services succeeded', () => {
    const result = classifyReleaseServiceOutcomes({
      type: 'staging',
      members: [
        { todoId: 'todo-a', todo: { serviceId: svcA, status: 'COMPLETED' } },
        { todoId: 'todo-b', todo: { serviceId: svcB, status: 'COMPLETED' } },
      ],
      deployments: [
        { serviceId: svcA, status: ReleaseDeploymentStatus.SUCCESSFUL },
        { serviceId: svcB, status: ReleaseDeploymentStatus.SUCCESSFUL },
      ],
      completedTodos: [],
    });

    expect(result.successfulServiceIds.sort()).toEqual([svcA, svcB]);
    expect(result.movableTodoIds).toEqual([]);
  });
});
