import { ReleaseType, TodoStatus } from '@todo-platform/shared-types';

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
        'Optional Jenkins deployment entries; when provided, monitoring starts and status becomes in_progress',
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
      description: 'Replace release content (only while not_started)',
    },
    todoIdsToAdd: {
      type: 'array',
      items: { type: 'string' },
      description: 'Append eligible todos (only while not_started)',
    },
    todoIdsToRemove: {
      type: 'array',
      items: { type: 'string' },
      description: 'Remove member todos (only while not_started)',
    },
    deployments: {
      type: 'array',
      items: releaseDeploymentInputSchema,
      description:
        'Attach or redeploy Jenkins URLs for non-successful member services (allowed on non-successful releases)',
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
