-- CreateEnum
CREATE TYPE "DeployedEnvironmentName" AS ENUM ('dev', 'uat', 'uat_main', 'staging');

-- CreateTable
CREATE TABLE "deployed_environments" (
    "id" TEXT NOT NULL,
    "name" "DeployedEnvironmentName" NOT NULL,
    "todoId" TEXT,
    "subtaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deployed_environments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deployed_environments_todoId_idx" ON "deployed_environments"("todoId");

-- CreateIndex
CREATE INDEX "deployed_environments_subtaskId_idx" ON "deployed_environments"("subtaskId");

-- CreateIndex
CREATE UNIQUE INDEX "deployed_environments_todoId_name_key" ON "deployed_environments"("todoId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "deployed_environments_subtaskId_name_key" ON "deployed_environments"("subtaskId", "name");

-- AddForeignKey
ALTER TABLE "deployed_environments" ADD CONSTRAINT "deployed_environments_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployed_environments" ADD CONSTRAINT "deployed_environments_subtaskId_fkey" FOREIGN KEY ("subtaskId") REFERENCES "subtasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
