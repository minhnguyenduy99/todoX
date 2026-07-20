import { ReleaseStatus as PrismaReleaseStatus } from '@prisma/client';

export const TERMINAL_RELEASE_STATUSES: PrismaReleaseStatus[] = [
  PrismaReleaseStatus.successful,
  PrismaReleaseStatus.partial_success,
  PrismaReleaseStatus.failed,
];

export const NON_TERMINAL_RELEASE_STATUSES: PrismaReleaseStatus[] = [
  PrismaReleaseStatus.not_started,
  PrismaReleaseStatus.in_progress,
];
