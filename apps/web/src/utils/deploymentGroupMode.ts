export type DeploymentGroupMode = 'service' | 'env';

const STORAGE_KEY = 'todox.deploymentGroupMode';

export function parseDeploymentGroupMode(value: string | null): DeploymentGroupMode {
  if (value === 'service' || value === 'env') {
    return value;
  }
  return 'service';
}

export function readDeploymentGroupModeFromStorage(): DeploymentGroupMode {
  try {
    return parseDeploymentGroupMode(localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'service';
  }
}

export function syncDeploymentGroupModeToStorage(mode: DeploymentGroupMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors (private browsing, quota, etc.)
  }
}
