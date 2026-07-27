-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('todo_deployment', 'subtask_deployment', 'release_deployment', 'testcase_scan');

-- CreateTable
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

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "notifications_read_at_idx" ON "notifications"("read_at");
