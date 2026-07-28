-- CreateEnum
CREATE TYPE "JenkinsBuildResult" AS ENUM ('SUCCESS', 'UNSTABLE', 'FAILURE', 'ABORTED');

-- AlterTable
ALTER TABLE "testcase_scans" ADD COLUMN "build_result" "JenkinsBuildResult";
