-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "key_name" TEXT NOT NULL,
    "display_name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "services_key_name_key" ON "services"("key_name");

-- AlterTable
ALTER TABLE "todos" ADD COLUMN "service_id" TEXT;

-- CreateIndex
CREATE INDEX "todos_service_id_idx" ON "todos"("service_id");

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
