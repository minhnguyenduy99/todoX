-- AlterTable
ALTER TABLE "monitors" ADD COLUMN "todoId" TEXT;

-- DropForeignKey
ALTER TABLE "monitors" DROP CONSTRAINT "monitors_subtaskId_fkey";

-- AlterTable
ALTER TABLE "monitors" ALTER COLUMN "subtaskId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "monitors_todoId_key" ON "monitors"("todoId");

-- AddForeignKey
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_subtaskId_fkey" FOREIGN KEY ("subtaskId") REFERENCES "subtasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce exactly one owner: todo XOR subtask
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_owner_xor" CHECK (
  ("todoId" IS NOT NULL AND "subtaskId" IS NULL) OR
  ("todoId" IS NULL AND "subtaskId" IS NOT NULL)
);
