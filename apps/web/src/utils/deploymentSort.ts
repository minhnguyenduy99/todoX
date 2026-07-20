import {
  DEPLOYED_ENVIRONMENT_ORDER,
  type DeployedEnvironmentDto,
} from '@todo-platform/shared-types';

export function getDeploymentSortKey(env: DeployedEnvironmentDto): number | null {
  if (!env.deployment) return null;

  if (typeof env.deployment.timestamp === 'number') {
    return env.deployment.timestamp;
  }

  const updatedAt = Date.parse(env.updatedAt);
  return Number.isNaN(updatedAt) ? null : updatedAt;
}

function compareByEnvironmentOrder(
  a: DeployedEnvironmentDto,
  b: DeployedEnvironmentDto,
): number {
  return (
    DEPLOYED_ENVIRONMENT_ORDER.indexOf(a.name) -
    DEPLOYED_ENVIRONMENT_ORDER.indexOf(b.name)
  );
}

export function sortDeploymentsForDisplay(
  environments: DeployedEnvironmentDto[],
): DeployedEnvironmentDto[] {
  const withHistory: DeployedEnvironmentDto[] = [];
  const envOnly: DeployedEnvironmentDto[] = [];

  for (const env of environments) {
    if (env.deployment) {
      withHistory.push(env);
    } else {
      envOnly.push(env);
    }
  }

  withHistory.sort((a, b) => {
    const keyA = getDeploymentSortKey(a) ?? 0;
    const keyB = getDeploymentSortKey(b) ?? 0;
    return keyB - keyA;
  });

  envOnly.sort(compareByEnvironmentOrder);

  return [...withHistory, ...envOnly];
}
