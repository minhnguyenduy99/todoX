import type { ServiceDto } from '@todo-platform/shared-types';

interface ServiceBadgeProps {
  service: ServiceDto;
  compact?: boolean;
}

export function ServiceBadge({ service, compact = false }: ServiceBadgeProps) {
  return (
    <span
      className={`service-badge${compact ? ' service-badge-compact' : ''}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {service.displayName}
    </span>
  );
}
