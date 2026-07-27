import { DeployedEnvironmentName, MonitorType } from '@todo-platform/shared-types';

const prismaEnvKeyByApiEnv: Record<DeployedEnvironmentName, string> = {
  [DeployedEnvironmentName.DEV]: 'dev',
  [DeployedEnvironmentName.UAT]: 'uat',
  [DeployedEnvironmentName.UAT_MAIN]: 'uat_main',
  [DeployedEnvironmentName.STAGING]: 'staging',
};

/** Stable slot key for per-owner monitor uniqueness. */
export function resolveMonitorEnvKey(
  type: MonitorType | string,
  config: Record<string, unknown> | null | undefined,
): string | null {
  if (type === MonitorType.DEPLOYMENT) {
    const env = config?.env;
    if (typeof env !== 'string' || !env) return null;
    if (env === 'prod') return 'prod';
    const apiEnv = env as DeployedEnvironmentName;
    if (Object.values(DeployedEnvironmentName).includes(apiEnv)) {
      return prismaEnvKeyByApiEnv[apiEnv];
    }
    return null;
  }

  if (typeof type === 'string' && type.length > 0) {
    return type;
  }

  return null;
}

export function deploymentEnvKeyFromConfig(
  config: Record<string, unknown> | null | undefined,
): string | null {
  return resolveMonitorEnvKey(MonitorType.DEPLOYMENT, config);
}
