import { ReleaseType, ReleaseStatus, TodoStatus } from '@todo-platform/shared-types';

export const releaseDeploymentInputSchema = {
  type: 'object' as const,
  properties: {
    serviceId: {
      type: 'string',
      description: 'Service UUID (optional if serviceKeyName is provided)',
    },
    serviceKeyName: {
      type: 'string',
      description: 'Service keyName (preferred for agents)',
    },
    jobUrl: {
      type: 'string',
      description: 'Jenkins job URL for this service deployment',
    },
    buildNumber: {
      type: 'number',
      description: 'Jenkins build number to monitor',
    },
  },
  required: ['jobUrl', 'buildNumber'],
};

export const createReleaseSchema = {
  type: 'object' as const,
  properties: {
    type: {
      type: 'string',
      enum: Object.values(ReleaseType),
      description:
        'staging: todos must be WAIT_FOR_STAGING; prod: todos must be COMPLETED on the active board',
    },
    releaseDate: {
      type: 'string',
      description: 'Release date in yyyy-mm-dd',
    },
    content: {
      type: 'string',
      description: 'Agent-authored release notes / changelog content',
    },
    todoIds: {
      type: 'array',
      items: { type: 'string' },
      description: 'Non-empty list of eligible todo IDs to include as members',
    },
    deployments: {
      type: 'array',
      items: releaseDeploymentInputSchema,
      description:
        'Optional Jenkins deployment entries; when provided, monitoring starts',
    },
  },
  required: ['type', 'releaseDate', 'content', 'todoIds'],
};

export const updateReleaseSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', description: 'Release ID' },
    content: {
      type: 'string',
      description: 'Replace release content (only before deployments are attached)',
    },
    todoIdsToAdd: {
      type: 'array',
      items: { type: 'string' },
      description: 'Append eligible todos (only before deployments are attached)',
    },
    todoIdsToRemove: {
      type: 'array',
      items: { type: 'string' },
      description: 'Remove member todos (only before deployments are attached)',
    },
    deployments: {
      type: 'array',
      items: releaseDeploymentInputSchema,
      description:
        'Attach or redeploy Jenkins URLs for non-successful member services (allowed on non-successful releases)',
    },
    status: {
      type: 'string',
      enum: Object.values(ReleaseStatus),
      description:
        'Manually set release status. Setting successful completes all staging member todos (or archives prod members).',
    },
  },
  required: ['id'],
};

export const releaseIdParamSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', description: 'Release ID' },
  },
  required: ['id'],
};

export const listTodosFilterSchema = {
  type: 'object' as const,
  properties: {
    status: {
      type: 'string',
      enum: Object.values(TodoStatus),
      description: 'Filter by todo status',
    },
    serviceId: {
      type: 'string',
      description: 'Filter by service UUID',
    },
    serviceKeyName: {
      type: 'string',
      description: 'Filter by service keyName',
    },
    availableForRelease: {
      type: 'boolean',
      description:
        'When true, only todos free of a non-terminal release membership',
    },
  },
};
