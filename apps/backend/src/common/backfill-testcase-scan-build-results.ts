import type { PrismaClient } from '@prisma/client';
import {
  JenkinsBuildResult,
  TestcaseScanStatus,
} from '@todo-platform/shared-types';
import { parseJenkinsJobUrl } from './parse-jenkins-job-url';
import { isJenkinsBuildResult } from './testcase-scan-status-sync';

interface JenkinsBuildPollResponse {
  building: boolean;
  result: string | null;
}

const BACKFILL_LIMIT = 10;

async function fetchJenkinsBuildResult(
  jobUrl: string,
  auth: string,
): Promise<JenkinsBuildResult | null> {
  const parsed = parseJenkinsJobUrl(jobUrl);
  const apiUrl = `${parsed.jobUrl}/${parsed.buildNumber}/api/json?tree=building,result`;

  const response = await fetch(apiUrl, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    return null;
  }

  const build = (await response.json()) as JenkinsBuildPollResponse;
  if (build.building || !build.result || !isJenkinsBuildResult(build.result)) {
    return null;
  }

  return build.result;
}

export async function backfillMissingTestcaseScanBuildResults(
  prisma: PrismaClient,
  auth: string | undefined,
): Promise<void> {
  if (!auth) return;

  const scans = await prisma.testcaseScan.findMany({
    where: {
      buildResult: null,
      jobUrl: { not: null },
      status: { in: [TestcaseScanStatus.COMPLETED, TestcaseScanStatus.FAILED] },
    },
    take: BACKFILL_LIMIT,
    orderBy: { updatedAt: 'desc' },
  });

  await Promise.all(
    scans.map(async (scan) => {
      if (!scan.jobUrl) return;
      try {
        const buildResult = await fetchJenkinsBuildResult(scan.jobUrl, auth);
        if (!buildResult) return;
        await prisma.testcaseScan.update({
          where: { id: scan.id },
          data: { buildResult },
        });
      } catch {
        // Best-effort backfill; skip on network/parse errors.
      }
    }),
  );
}
