import {
  MonitorType,
  TestcaseScanStatus,
  type TestcaseScanInput,
} from '@todo-platform/shared-types';
import type { PrismaService } from '../prisma/prisma.service';
import type { MonitorsService } from '../monitors/monitors.service';
import type { TestcaseScan } from '@prisma/client';
import { parseJenkinsJobUrl } from './parse-jenkins-job-url';
import { DEFAULT_TESTCASE_SCAN_CRON } from './testcase-scan.constants';

export async function createTestcaseScanRecord(
  prisma: PrismaService,
  monitorsService: MonitorsService,
  todoId: string,
  input: TestcaseScanInput,
  options?: { silent?: boolean },
): Promise<TestcaseScan> {
  const hasJobUrl = Boolean(input.jobUrl);
  const status = hasJobUrl
    ? TestcaseScanStatus.SCANNING
    : (input.status ?? TestcaseScanStatus.COMPLETED);

  const scan = await prisma.testcaseScan.create({
    data: {
      todoId,
      name: input.name,
      status,
      jobUrl: input.jobUrl ?? null,
    },
  });

  if (hasJobUrl && input.jobUrl) {
    const parsed = parseJenkinsJobUrl(input.jobUrl);
    await monitorsService.createForTestcaseScan(
      scan.id,
      {
        type: MonitorType.TESTCASE_SCAN,
        cron: DEFAULT_TESTCASE_SCAN_CRON,
        enabled: true,
        config: parsed as unknown as Record<string, unknown>,
      },
      options,
    );
  }

  return scan;
}

export async function syncTestcaseScans(
  prisma: PrismaService,
  monitorsService: MonitorsService,
  todoId: string,
  testcaseScanHistory: TestcaseScanInput[] | undefined,
  options?: { silent?: boolean },
): Promise<void> {
  if (testcaseScanHistory === undefined) return;

  await prisma.testcaseScan.deleteMany({ where: { todoId } });

  for (const input of testcaseScanHistory) {
    await createTestcaseScanRecord(prisma, monitorsService, todoId, input, options);
  }
}
