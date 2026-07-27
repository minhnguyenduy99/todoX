-- AlterTable
ALTER TABLE "monitors" ADD COLUMN "env_key" TEXT;

-- Backfill env_key from deployment config env or monitor type
UPDATE "monitors"
SET "env_key" = CASE
  WHEN "type" = 'deployment' THEN CASE COALESCE("config"->>'env', 'deployment')
    WHEN 'uat-main' THEN 'uat_main'
    ELSE COALESCE("config"->>'env', 'deployment')
  END
  ELSE "type"::text
END;

-- Drop old single-owner unique indexes
DROP INDEX IF EXISTS "monitors_todoId_key";
DROP INDEX IF EXISTS "monitors_subtaskId_key";

-- CreateIndex
CREATE INDEX "monitors_todoId_idx" ON "monitors"("todoId");

-- CreateIndex
CREATE INDEX "monitors_subtaskId_idx" ON "monitors"("subtaskId");

-- CreateIndex
CREATE UNIQUE INDEX "monitors_todoId_env_key_key" ON "monitors"("todoId", "env_key");

-- CreateIndex
CREATE UNIQUE INDEX "monitors_subtaskId_env_key_key" ON "monitors"("subtaskId", "env_key");
