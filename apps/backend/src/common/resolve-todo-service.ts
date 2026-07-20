import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

export type TodoServiceInput = {
  serviceId?: string | null;
  serviceKeyName?: string | null;
};

export type TodoServiceResolution =
  | { action: 'connect'; serviceId: string }
  | { action: 'disconnect' }
  | { action: 'unchanged' };

export async function resolveTodoServiceInput(
  prisma: PrismaService,
  input: TodoServiceInput,
): Promise<TodoServiceResolution> {
  const { serviceId, serviceKeyName } = input;
  const hasServiceId = serviceId !== undefined;
  const hasServiceKeyName = serviceKeyName !== undefined;

  if (!hasServiceId && !hasServiceKeyName) {
    return { action: 'unchanged' };
  }

  if (serviceId === null || serviceKeyName === null) {
    return { action: 'disconnect' };
  }

  if (hasServiceId && hasServiceKeyName) {
    const byId = await prisma.service.findUnique({ where: { id: serviceId! } });
    if (!byId) {
      throw new BadRequestException(`Service '${serviceId}' not found`);
    }

    const byKey = await prisma.service.findUnique({ where: { keyName: serviceKeyName! } });
    if (!byKey) {
      throw new BadRequestException(`Service '${serviceKeyName}' not found`);
    }

    if (byId.id !== byKey.id) {
      throw new BadRequestException(
        'serviceId and serviceKeyName refer to different services',
      );
    }

    return { action: 'connect', serviceId: byId.id };
  }

  if (hasServiceId) {
    const byId = await prisma.service.findUnique({ where: { id: serviceId! } });
    if (!byId) {
      throw new BadRequestException(`Service '${serviceId}' not found`);
    }
    return { action: 'connect', serviceId: byId.id };
  }

  const byKey = await prisma.service.findUnique({ where: { keyName: serviceKeyName! } });
  if (!byKey) {
    throw new BadRequestException(`Service '${serviceKeyName}' not found`);
  }
  return { action: 'connect', serviceId: byKey.id };
}

export function applyTodoServiceResolution(
  resolution: TodoServiceResolution,
  options?: { forCreate?: boolean },
): { service: { connect: { id: string } } } | { service: { disconnect: true } } | undefined {
  if (resolution.action === 'connect') {
    return { service: { connect: { id: resolution.serviceId } } };
  }
  if (resolution.action === 'disconnect') {
    if (options?.forCreate) {
      return undefined;
    }
    return { service: { disconnect: true } };
  }
  return undefined;
}
