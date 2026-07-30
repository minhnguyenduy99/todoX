-- AlterTable
ALTER TABLE "todos" ADD COLUMN "status_update_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill from updatedAt for existing rows
UPDATE "todos" SET "status_update_date" = "updatedAt";
