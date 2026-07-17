import {
  DEPLOYED_ENVIRONMENT_ORDER,
  type DeployedEnvironmentDto,
  type DeployedEnvironmentName,
} from '@todo-platform/shared-types';

interface DeployedEnvironmentListProps {
  deployedEnvironments: DeployedEnvironmentDto[];
  compact?: boolean;
}

function envChipClassName(name: DeployedEnvironmentName): string {
  switch (name) {
    case 'dev':
      return 'env-chip-dev';
    case 'uat':
      return 'env-chip-uat';
    case 'uat-main':
      return 'env-chip-uat-main';
    case 'staging':
      return 'env-chip-staging';
    default:
      return 'env-chip-default';
  }
}

function sortEnvironments(
  environments: DeployedEnvironmentDto[],
): DeployedEnvironmentDto[] {
  return [...environments].sort(
    (a, b) =>
      DEPLOYED_ENVIRONMENT_ORDER.indexOf(a.name) -
      DEPLOYED_ENVIRONMENT_ORDER.indexOf(b.name),
  );
}

export function DeployedEnvironmentList({
  deployedEnvironments,
  compact = false,
}: DeployedEnvironmentListProps) {
  if (deployedEnvironments.length === 0) return null;

  const sorted = sortEnvironments(deployedEnvironments);

  return (
    <div
      className={`env-list${compact ? ' env-list-compact' : ''}`}
      title="Deployed environments"
    >
      {sorted.map((env) => (
        <span
          key={env.id}
          className={`env-chip ${envChipClassName(env.name)}`}
          title={`Deployed to ${env.name}`}
        >
          {env.name}
        </span>
      ))}
    </div>
  );
}
