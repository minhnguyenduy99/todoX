-- CreateEnum
CREATE TYPE "AssociatedTicketType" AS ENUM ('feature', 'bug');

-- AlterTable
ALTER TABLE "todos" ADD COLUMN "associatedTicketTitle" TEXT,
ADD COLUMN "associatedTicketType" "AssociatedTicketType",
ADD COLUMN "associatedTicketLink" TEXT;
