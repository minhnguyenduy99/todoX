-- Replace TODO/BLOCKED with NOT_STARTED/WAIT_FOR_STAGING and reorder enum values
CREATE TYPE "TodoStatus_new" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'TESTING',
  'WAIT_FOR_STAGING',
  'COMPLETED'
);

ALTER TABLE "todos" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "todos"
  ALTER COLUMN "status" TYPE "TodoStatus_new"
  USING (
    CASE "status"::text
      WHEN 'TODO' THEN 'NOT_STARTED'
      WHEN 'BLOCKED' THEN 'WAIT_FOR_STAGING'
      ELSE "status"::text
    END
  )::"TodoStatus_new";

ALTER TABLE "todos" ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED';

DROP TYPE "TodoStatus";
ALTER TYPE "TodoStatus_new" RENAME TO "TodoStatus";
