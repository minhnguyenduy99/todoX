export const serviceKeyNameSchema = {
  type: 'string' as const,
  description:
    'Stable service identifier (lowercase slug: a-z, 0-9, _, -). Prefer this over serviceId for agents.',
};

export const createServiceSchema = {
  type: 'object' as const,
  properties: {
    keyName: serviceKeyNameSchema,
    displayName: {
      type: 'string',
      description: 'Optional human-readable label; defaults to keyName when omitted',
    },
  },
  required: ['keyName'],
};

export const updateServiceSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', description: 'Service ID' },
    displayName: {
      type: 'string',
      description: 'Updated display label (omit keyName — it is immutable)',
    },
  },
  required: ['id'],
};

export const serviceIdParamSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', description: 'Service ID' },
  },
  required: ['id'],
};

export const todoServiceFields = {
  serviceId: {
    type: 'string',
    description: 'Service UUID (optional; use serviceKeyName when possible)',
  },
  serviceKeyName: serviceKeyNameSchema,
};
