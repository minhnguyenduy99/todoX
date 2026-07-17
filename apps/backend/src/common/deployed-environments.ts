import {
  DEPLOYED_ENVIRONMENT_ORDER,
  DeployedEnvironmentName,
} from '@todo-platform/shared-types';
import type { PrismaService } from '../prisma/prisma.service';

const prismaNameByApiName: Record<DeployedEnvironmentName, string> = {
  [DeployedEnvironmentName.DEV]: 'dev',
  [DeployedEnvironmentName.UAT]: 'uat',
  [DeployedEnvironmentName.UAT_MAIN]: 'uat_main',
  [DeployedEnvironmentName.STAGING]: 'staging',
};

export function toPrismaDeployedEnvironmentName(
  name: DeployedEnvironmentName,
): 'dev' | 'uat' | 'uat_main' | 'staging' {
  return prismaNameByApiName[name] as 'dev' | 'uat' | 'uat_main' | 'staging';
}

export function sortDeployedEnvironmentNames(
  names: DeployedEnvironmentName[],
): DeployedEnvironmentName[] {
  return [...names].sort(
    (a, b) =>
      DEPLOYED_ENVIRONMENT_ORDER.indexOf(a) - DEPLOYED_ENVIRONMENT_ORDER.indexOf(b),
  );
}

export async function syncDeployedEnvironments(
  prisma: PrismaService,
  scope: { todoId: string } | { subtaskId: string },
  environments: DeployedEnvironmentName[] | undefined,
): Promise<void> {
  if (environments === undefined) return;

  const where = 'todoId' in scope ? { todoId: scope.todoId } : { subtaskId: scope.subtaskId };
  const uniqueNames = sortDeployedEnvironmentNames([...new Set(environments)]);

  await prisma.$transaction([
    prisma.deployedEnvironment.deleteMany({ where }),
    ...uniqueNames.map((name) =>
      prisma.deployedEnvironment.create({
        data: {
          ...where,
          name: toPrismaDeployedEnvironmentName(name),
        },
      }),
    ),
  ]);
}
