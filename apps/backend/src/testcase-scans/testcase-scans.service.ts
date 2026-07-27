import { Injectable, NotFoundException } from '@nestjs/common';
import type { TestcaseScanDto, TestcaseScanInput } from '@todo-platform/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { MonitorsService } from '../monitors/monitors.service';
import { EventsGateway } from '../events/events.gateway';
import { toTestcaseScanDto, toTodoDto } from '../common/mappers';
import { createTestcaseScanRecord } from '../common/sync-testcase-scans';

const todoInclude = {
  monitors: true,
  service: true,
  subtasks: {
    include: {
      monitors: true,
      pullRequests: { orderBy: { number: 'asc' as const } },
      deployedEnvironments: { orderBy: { name: 'asc' as const } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  pullRequests: { orderBy: { number: 'asc' as const } },
  associatedTickets: { orderBy: { createdAt: 'asc' as const } },
  deployedEnvironments: { orderBy: { name: 'asc' as const } },
  testcaseScans: { orderBy: { createdAt: 'desc' as const } },
};

@Injectable()
export class TestcaseScansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly monitorsService: MonitorsService,
    private readonly events: EventsGateway,
  ) {}

  async create(todoId: string, input: TestcaseScanInput): Promise<TestcaseScanDto> {
    await this.ensureTodoExists(todoId);
    const scan = await createTestcaseScanRecord(
      this.prisma,
      this.monitorsService,
      todoId,
      input,
    );
    await this.broadcastTodoUpdated(todoId);
    return toTestcaseScanDto(scan);
  }

  async remove(todoId: string, scanId: string): Promise<void> {
    await this.ensureTodoExists(todoId);
    const scan = await this.prisma.testcaseScan.findFirst({
      where: { id: scanId, todoId },
      include: { monitor: true },
    });
    if (!scan) {
      throw new NotFoundException(`Testcase scan ${scanId} not found on todo ${todoId}`);
    }

    if (scan.monitor) {
      await this.monitorsService.remove(scan.monitor.id);
    }

    await this.prisma.testcaseScan.delete({ where: { id: scanId } });
    await this.broadcastTodoUpdated(todoId);
  }

  private async ensureTodoExists(todoId: string): Promise<void> {
    const todo = await this.prisma.todo.findUnique({ where: { id: todoId } });
    if (!todo) throw new NotFoundException(`Todo ${todoId} not found`);
  }

  private async broadcastTodoUpdated(todoId: string): Promise<void> {
    const todo = await this.prisma.todo.findUnique({
      where: { id: todoId },
      include: todoInclude,
    });
    if (todo) {
      this.events.broadcast('todo.updated', toTodoDto(todo));
    }
  }
}
