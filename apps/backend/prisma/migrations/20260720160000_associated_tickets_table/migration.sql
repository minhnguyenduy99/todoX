-- CreateTable
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

-- Migrate existing inline ticket data
INSERT INTO "associated_tickets" ("id", "title", "type", "link", "todoId", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    "associatedTicketTitle",
    "associatedTicketType",
    "associatedTicketLink",
    "id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "todos"
WHERE "associatedTicketTitle" IS NOT NULL
  AND "associatedTicketType" IS NOT NULL
  AND "associatedTicketLink" IS NOT NULL;

-- AlterTable
ALTER TABLE "todos" DROP COLUMN "associatedTicketTitle",
DROP COLUMN "associatedTicketType",
DROP COLUMN "associatedTicketLink";

-- CreateIndex
CREATE INDEX "associated_tickets_todoId_idx" ON "associated_tickets"("todoId");

-- AddForeignKey
ALTER TABLE "associated_tickets" ADD CONSTRAINT "associated_tickets_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
