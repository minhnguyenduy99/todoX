-- CreateEnum
CREATE TYPE "TestcaseScanStatus" AS ENUM ('scanning', 'completed', 'failed');

-- AlterEnum
ALTER TYPE "MonitorType" ADD VALUE 'testcase_scan';

-- CreateTable
CREATE TABLE "testcase_scans" (
    "id" TEXT NOT NULL,
    "todo_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TestcaseScanStatus" NOT NULL DEFAULT 'scanning',
    "job_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testcase_scans_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "monitors" ADD COLUMN "testcase_scan_id" TEXT;

-- CreateIndex
CREATE INDEX "testcase_scans_todo_id_idx" ON "testcase_scans"("todo_id");

-- CreateIndex
CREATE UNIQUE INDEX "monitors_testcase_scan_id_key" ON "monitors"("testcase_scan_id");

-- AddForeignKey
ALTER TABLE "testcase_scans" ADD CONSTRAINT "testcase_scans_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_testcase_scan_id_fkey" FOREIGN KEY ("testcase_scan_id") REFERENCES "testcase_scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Replace three-way XOR with four-way XOR (exactly one owner)
ALTER TABLE "monitors" DROP CONSTRAINT "monitors_owner_xor";
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_owner_xor" CHECK (
  ("todoId" IS NOT NULL AND "subtaskId" IS NULL AND "release_deployment_id" IS NULL AND "testcase_scan_id" IS NULL) OR
  ("todoId" IS NULL AND "subtaskId" IS NOT NULL AND "release_deployment_id" IS NULL AND "testcase_scan_id" IS NULL) OR
  ("todoId" IS NULL AND "subtaskId" IS NULL AND "release_deployment_id" IS NOT NULL AND "testcase_scan_id" IS NULL) OR
  ("todoId" IS NULL AND "subtaskId" IS NULL AND "release_deployment_id" IS NULL AND "testcase_scan_id" IS NOT NULL)
);
