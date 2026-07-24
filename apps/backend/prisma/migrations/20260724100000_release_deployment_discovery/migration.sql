-- AlterEnum
ALTER TYPE "MonitorType" ADD VALUE 'deployment_discovery';

-- AlterTable
ALTER TABLE "monitors" ADD COLUMN "release_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "monitors_release_id_key" ON "monitors"("release_id");

-- AddForeignKey
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Replace four-way XOR with five-way XOR (exactly one owner)
ALTER TABLE "monitors" DROP CONSTRAINT "monitors_owner_xor";
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_owner_xor" CHECK (
  ("todoId" IS NOT NULL AND "subtaskId" IS NULL AND "release_deployment_id" IS NULL AND "release_id" IS NULL AND "testcase_scan_id" IS NULL) OR
  ("todoId" IS NULL AND "subtaskId" IS NOT NULL AND "release_deployment_id" IS NULL AND "release_id" IS NULL AND "testcase_scan_id" IS NULL) OR
  ("todoId" IS NULL AND "subtaskId" IS NULL AND "release_deployment_id" IS NOT NULL AND "release_id" IS NULL AND "testcase_scan_id" IS NULL) OR
  ("todoId" IS NULL AND "subtaskId" IS NULL AND "release_deployment_id" IS NULL AND "release_id" IS NOT NULL AND "testcase_scan_id" IS NULL) OR
  ("todoId" IS NULL AND "subtaskId" IS NULL AND "release_deployment_id" IS NULL AND "release_id" IS NULL AND "testcase_scan_id" IS NOT NULL)
);
