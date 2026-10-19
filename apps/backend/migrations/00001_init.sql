-- Squashed schema from main-branch Prisma migrations:
--   20250716000000_init
--   20250717000000_add_testing_status
--   20250717100000_add_associated_pull_requests
--   20250717110000_add_deployed_environments
--   20250717120000_replace_blocked_with_wait_for_staging
--   20250720120000_todo_monitor
--   20260720140000_add_associated_ticket_to_todos
--   20260720160000_associated_tickets_table
--   20260720180000_services_table
--   20260720210000_release_generation
--   20260721100000_testcase_scan_history
--   20260722100000_service_deployments
--   20260723100000_todo_changelog
--   20260724100000_release_deployment_discovery
--   20260727100000_multi_env_monitors
--   20260727110000_notifications
--   20260728100000_testcase_scan_build_result
--   20260730100000_todo_status_update_date
--
-- Intermediate columns and enum renames are omitted; this is the final schema.
-- Apply on an empty database. Do not run this against a DB that already has
-- Prisma migrations applied.

-- +goose Up

CREATE TYPE "TodoStatus" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'TESTING',
  'WAIT_FOR_STAGING',
  'COMPLETED'
);

CREATE TYPE "SubtaskStatus" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'TESTING',
  'COMPLETED',
  'FAILED'
);

CREATE TYPE "MonitorType" AS ENUM (
  'http',
  'github_pr',
  'deployment',
  'deployment_discovery',
  'testcase_scan'
);

CREATE TYPE "TestcaseScanStatus" AS ENUM ('scanning', 'completed', 'failed');

CREATE TYPE "JenkinsBuildResult" AS ENUM ('SUCCESS', 'UNSTABLE', 'FAILURE', 'ABORTED');

CREATE TYPE "DeployedEnvironmentName" AS ENUM ('dev', 'uat', 'uat_main', 'staging');

CREATE TYPE "AssociatedTicketType" AS ENUM ('feature', 'bug');

CREATE TYPE "ReleaseType" AS ENUM ('staging', 'prod');

CREATE TYPE "ReleaseStatus" AS ENUM (
  'not_started',
  'in_progress',
  'successful',
  'partial_success',
  'failed'
);

CREATE TYPE "ReleaseDeploymentStatus" AS ENUM (
  'pending',
  'in_progress',
  'successful',
  'failed'
);

CREATE TYPE "NotificationKind" AS ENUM (
  'todo_deployment',
  'subtask_deployment',
  'release_deployment',
  'testcase_scan'
);

CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "key_name" TEXT NOT NULL,
    "display_name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "services_key_name_key" ON "services"("key_name");

CREATE TABLE "todos" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "changelog" TEXT,
    "status" "TodoStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "status_update_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "service_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "todos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "todos_service_id_idx" ON "todos"("service_id");

ALTER TABLE "todos"
  ADD CONSTRAINT "todos_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "subtasks" (
    "id" TEXT NOT NULL,
    "todoId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SubtaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subtasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "subtasks_todoId_idx" ON "subtasks"("todoId");

ALTER TABLE "subtasks"
  ADD CONSTRAINT "subtasks_todoId_fkey"
  FOREIGN KEY ("todoId") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "associated_pull_requests" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "todoId" TEXT,
    "subtaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "associated_pull_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "associated_pull_requests_todoId_idx" ON "associated_pull_requests"("todoId");
CREATE INDEX "associated_pull_requests_subtaskId_idx" ON "associated_pull_requests"("subtaskId");

ALTER TABLE "associated_pull_requests"
  ADD CONSTRAINT "associated_pull_requests_todoId_fkey"
  FOREIGN KEY ("todoId") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "associated_pull_requests"
  ADD CONSTRAINT "associated_pull_requests_subtaskId_fkey"
  FOREIGN KEY ("subtaskId") REFERENCES "subtasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "associated_tickets" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "AssociatedTicketType" NOT NULL,
    "link" TEXT NOT NULL,
    "todoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "associated_tickets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "associated_tickets_todoId_idx" ON "associated_tickets"("todoId");

ALTER TABLE "associated_tickets"
  ADD CONSTRAINT "associated_tickets_todoId_fkey"
  FOREIGN KEY ("todoId") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "deployed_environments" (
    "id" TEXT NOT NULL,
    "name" "DeployedEnvironmentName" NOT NULL,
    "todoId" TEXT,
    "subtaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deployed_environments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "deployed_environments_todoId_idx" ON "deployed_environments"("todoId");
CREATE INDEX "deployed_environments_subtaskId_idx" ON "deployed_environments"("subtaskId");
CREATE UNIQUE INDEX "deployed_environments_todoId_name_key" ON "deployed_environments"("todoId", "name");
CREATE UNIQUE INDEX "deployed_environments_subtaskId_name_key" ON "deployed_environments"("subtaskId", "name");

ALTER TABLE "deployed_environments"
  ADD CONSTRAINT "deployed_environments_todoId_fkey"
  FOREIGN KEY ("todoId") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deployed_environments"
  ADD CONSTRAINT "deployed_environments_subtaskId_fkey"
  FOREIGN KEY ("subtaskId") REFERENCES "subtasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "releases" (
    "id" TEXT NOT NULL,
    "release_date" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "ReleaseType" NOT NULL,
    "status" "ReleaseStatus" NOT NULL DEFAULT 'not_started',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "releases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "releases_release_date_idx" ON "releases"("release_date");

CREATE TABLE "release_members" (
    "id" TEXT NOT NULL,
    "release_id" TEXT NOT NULL,
    "todo_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "release_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "release_members_release_id_todo_id_key" ON "release_members"("release_id", "todo_id");
CREATE INDEX "release_members_todo_id_idx" ON "release_members"("todo_id");

ALTER TABLE "release_members"
  ADD CONSTRAINT "release_members_release_id_fkey"
  FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "release_members"
  ADD CONSTRAINT "release_members_todo_id_fkey"
  FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "release_deployments" (
    "id" TEXT NOT NULL,
    "release_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "environment" "ReleaseType" NOT NULL,
    "job_url" TEXT,
    "build_number" INTEGER,
    "status" "ReleaseDeploymentStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "release_deployments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "release_deployments_release_id_service_id_key" ON "release_deployments"("release_id", "service_id");
CREATE INDEX "release_deployments_service_id_idx" ON "release_deployments"("service_id");

ALTER TABLE "release_deployments"
  ADD CONSTRAINT "release_deployments_release_id_fkey"
  FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "release_deployments"
  ADD CONSTRAINT "release_deployments_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "completed_todos" (
    "id" TEXT NOT NULL,
    "original_todo_id" TEXT NOT NULL,
    "release_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "changelog" TEXT,
    "status" "TodoStatus" NOT NULL,
    "service_id" TEXT,
    "associated_tickets" JSONB NOT NULL DEFAULT '[]',
    "pull_requests" JSONB NOT NULL DEFAULT '[]',
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "completed_todos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "completed_todos_release_id_idx" ON "completed_todos"("release_id");
CREATE INDEX "completed_todos_original_todo_id_idx" ON "completed_todos"("original_todo_id");
CREATE INDEX "completed_todos_service_id_idx" ON "completed_todos"("service_id");

ALTER TABLE "completed_todos"
  ADD CONSTRAINT "completed_todos_release_id_fkey"
  FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "completed_todos"
  ADD CONSTRAINT "completed_todos_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "testcase_scans" (
    "id" TEXT NOT NULL,
    "todo_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TestcaseScanStatus" NOT NULL DEFAULT 'scanning',
    "build_result" "JenkinsBuildResult",
    "job_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testcase_scans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "testcase_scans_todo_id_idx" ON "testcase_scans"("todo_id");

ALTER TABLE "testcase_scans"
  ADD CONSTRAINT "testcase_scans_todo_id_fkey"
  FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "monitors" (
    "id" TEXT NOT NULL,
    "todoId" TEXT,
    "subtaskId" TEXT,
    "release_deployment_id" TEXT,
    "release_id" TEXT,
    "testcase_scan_id" TEXT,
    "env_key" TEXT,
    "type" "MonitorType" NOT NULL,
    "cron" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "monitors_release_deployment_id_key" ON "monitors"("release_deployment_id");
CREATE UNIQUE INDEX "monitors_release_id_key" ON "monitors"("release_id");
CREATE UNIQUE INDEX "monitors_testcase_scan_id_key" ON "monitors"("testcase_scan_id");
CREATE INDEX "monitors_todoId_idx" ON "monitors"("todoId");
CREATE INDEX "monitors_subtaskId_idx" ON "monitors"("subtaskId");
CREATE UNIQUE INDEX "monitors_todoId_env_key_key" ON "monitors"("todoId", "env_key");
CREATE UNIQUE INDEX "monitors_subtaskId_env_key_key" ON "monitors"("subtaskId", "env_key");

ALTER TABLE "monitors"
  ADD CONSTRAINT "monitors_todoId_fkey"
  FOREIGN KEY ("todoId") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monitors"
  ADD CONSTRAINT "monitors_subtaskId_fkey"
  FOREIGN KEY ("subtaskId") REFERENCES "subtasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monitors"
  ADD CONSTRAINT "monitors_release_deployment_id_fkey"
  FOREIGN KEY ("release_deployment_id") REFERENCES "release_deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monitors"
  ADD CONSTRAINT "monitors_release_id_fkey"
  FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monitors"
  ADD CONSTRAINT "monitors_testcase_scan_id_fkey"
  FOREIGN KEY ("testcase_scan_id") REFERENCES "testcase_scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monitors" ADD CONSTRAINT "monitors_owner_xor" CHECK (
  ("todoId" IS NOT NULL AND "subtaskId" IS NULL AND "release_deployment_id" IS NULL AND "release_id" IS NULL AND "testcase_scan_id" IS NULL) OR
  ("todoId" IS NULL AND "subtaskId" IS NOT NULL AND "release_deployment_id" IS NULL AND "release_id" IS NULL AND "testcase_scan_id" IS NULL) OR
  ("todoId" IS NULL AND "subtaskId" IS NULL AND "release_deployment_id" IS NOT NULL AND "release_id" IS NULL AND "testcase_scan_id" IS NULL) OR
  ("todoId" IS NULL AND "subtaskId" IS NULL AND "release_deployment_id" IS NULL AND "release_id" IS NOT NULL AND "testcase_scan_id" IS NULL) OR
  ("todoId" IS NULL AND "subtaskId" IS NULL AND "release_deployment_id" IS NULL AND "release_id" IS NULL AND "testcase_scan_id" IS NOT NULL)
);

CREATE TABLE "service_deployments" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "job_url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_deployments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_deployments_service_id_idx" ON "service_deployments"("service_id");
CREATE UNIQUE INDEX "service_deployments_service_id_environment_key" ON "service_deployments"("service_id", "environment");

ALTER TABLE "service_deployments"
  ADD CONSTRAINT "service_deployments_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");
CREATE INDEX "notifications_read_at_idx" ON "notifications"("read_at");

-- +goose Down

DROP TABLE IF EXISTS "notifications";
DROP TABLE IF EXISTS "service_deployments";
DROP TABLE IF EXISTS "monitors";
DROP TABLE IF EXISTS "testcase_scans";
DROP TABLE IF EXISTS "completed_todos";
DROP TABLE IF EXISTS "release_deployments";
DROP TABLE IF EXISTS "release_members";
DROP TABLE IF EXISTS "releases";
DROP TABLE IF EXISTS "deployed_environments";
DROP TABLE IF EXISTS "associated_tickets";
DROP TABLE IF EXISTS "associated_pull_requests";
DROP TABLE IF EXISTS "subtasks";
DROP TABLE IF EXISTS "todos";
DROP TABLE IF EXISTS "services";

DROP TYPE IF EXISTS "NotificationKind";
DROP TYPE IF EXISTS "ReleaseDeploymentStatus";
DROP TYPE IF EXISTS "ReleaseStatus";
DROP TYPE IF EXISTS "ReleaseType";
DROP TYPE IF EXISTS "AssociatedTicketType";
DROP TYPE IF EXISTS "DeployedEnvironmentName";
DROP TYPE IF EXISTS "JenkinsBuildResult";
DROP TYPE IF EXISTS "TestcaseScanStatus";
DROP TYPE IF EXISTS "MonitorType";
DROP TYPE IF EXISTS "SubtaskStatus";
DROP TYPE IF EXISTS "TodoStatus";
