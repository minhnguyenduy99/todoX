import { ReleaseStatus as PrismaReleaseStatus } from '@prisma/client';

/** Terminal: release is done. partial_success is in-flight (some services succeeded). */
export const TERMINAL_RELEASE_STATUSES: PrismaReleaseStatus[] = [
  PrismaReleaseStatus.successful,
  PrismaReleaseStatus.failed,
];

export const NON_TERMINAL_RELEASE_STATUSES: PrismaReleaseStatus[] = [
  PrismaReleaseStatus.not_started,
  PrismaReleaseStatus.in_progress,
  PrismaReleaseStatus.partial_success,
];
