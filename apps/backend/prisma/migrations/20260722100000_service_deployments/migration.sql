-- CreateTable
CREATE TABLE "service_deployments" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "job_url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_deployments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_deployments_service_id_idx" ON "service_deployments"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_deployments_service_id_environment_key" ON "service_deployments"("service_id", "environment");

-- AddForeignKey
ALTER TABLE "service_deployments" ADD CONSTRAINT "service_deployments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
