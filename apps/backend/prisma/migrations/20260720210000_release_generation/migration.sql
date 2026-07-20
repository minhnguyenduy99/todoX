-- CreateEnum
CREATE TYPE "ReleaseType" AS ENUM ('staging', 'prod');

-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('not_started', 'in_progress', 'successful', 'partial_success', 'failed');

-- CreateEnum
CREATE TYPE "ReleaseDeploymentStatus" AS ENUM ('pending', 'in_progress', 'successful', 'failed');

-- CreateTable
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

-- CreateTable
CREATE TABLE "release_members" (
    "id" TEXT NOT NULL,
    "release_id" TEXT NOT NULL,
    "todo_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "release_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "completed_todos" (
    "id" TEXT NOT NULL,
    "original_todo_id" TEXT NOT NULL,
    "release_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TodoStatus" NOT NULL,
    "service_id" TEXT,
    "associated_tickets" JSONB NOT NULL DEFAULT '[]',
    "pull_requests" JSONB NOT NULL DEFAULT '[]',
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "completed_todos_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "monitors" ADD COLUMN "release_deployment_id" TEXT;

-- CreateIndex
CREATE INDEX "releases_release_date_idx" ON "releases"("release_date");

-- CreateIndex
CREATE UNIQUE INDEX "release_members_release_id_todo_id_key" ON "release_members"("release_id", "todo_id");

-- CreateIndex
CREATE INDEX "release_members_todo_id_idx" ON "release_members"("todo_id");

-- CreateIndex
CREATE UNIQUE INDEX "release_deployments_release_id_service_id_key" ON "release_deployments"("release_id", "service_id");

-- CreateIndex
CREATE INDEX "release_deployments_service_id_idx" ON "release_deployments"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "monitors_release_deployment_id_key" ON "monitors"("release_deployment_id");

-- CreateIndex
CREATE INDEX "completed_todos_release_id_idx" ON "completed_todos"("release_id");

-- CreateIndex
CREATE INDEX "completed_todos_original_todo_id_idx" ON "completed_todos"("original_todo_id");

-- CreateIndex
CREATE INDEX "completed_todos_service_id_idx" ON "completed_todos"("service_id");

-- AddForeignKey
ALTER TABLE "release_members" ADD CONSTRAINT "release_members_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_members" ADD CONSTRAINT "release_members_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_deployments" ADD CONSTRAINT "release_deployments_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_deployments" ADD CONSTRAINT "release_deployments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_release_deployment_id_fkey" FOREIGN KEY ("release_deployment_id") REFERENCES "release_deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "completed_todos" ADD CONSTRAINT "completed_todos_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "completed_todos" ADD CONSTRAINT "completed_todos_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Replace two-way XOR with three-way XOR (exactly one owner)
ALTER TABLE "monitors" DROP CONSTRAINT "monitors_owner_xor";
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_owner_xor" CHECK (
  ("todoId" IS NOT NULL AND "subtaskId" IS NULL AND "release_deployment_id" IS NULL) OR
  ("todoId" IS NULL AND "subtaskId" IS NOT NULL AND "release_deployment_id" IS NULL) OR
  ("todoId" IS NULL AND "subtaskId" IS NULL AND "release_deployment_id" IS NOT NULL)
);
