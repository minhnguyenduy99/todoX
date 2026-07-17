-- CreateTable
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

-- CreateIndex
CREATE INDEX "associated_pull_requests_todoId_idx" ON "associated_pull_requests"("todoId");

-- CreateIndex
CREATE INDEX "associated_pull_requests_subtaskId_idx" ON "associated_pull_requests"("subtaskId");

-- AddForeignKey
ALTER TABLE "associated_pull_requests" ADD CONSTRAINT "associated_pull_requests_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "associated_pull_requests" ADD CONSTRAINT "associated_pull_requests_subtaskId_fkey" FOREIGN KEY ("subtaskId") REFERENCES "subtasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
