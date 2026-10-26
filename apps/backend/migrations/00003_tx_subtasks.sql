-- Subtasks belong to a todo and are written in the same transaction as the parent row.
-- position preserves the order subtasks were added.

-- +goose Up

CREATE TYPE tx_subtask_status AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

CREATE TABLE tx_subtasks (
    id TEXT NOT NULL,
    todo_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status tx_subtask_status NOT NULL DEFAULT 'NOT_STARTED',
    position INTEGER NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT tx_subtasks_pkey PRIMARY KEY (id)
);

CREATE INDEX tx_subtasks_todo_id_idx ON tx_subtasks (todo_id);

ALTER TABLE tx_subtasks
  ADD CONSTRAINT tx_subtasks_todo_id_fkey
  FOREIGN KEY (todo_id) REFERENCES tx_todos (id) ON DELETE CASCADE ON UPDATE CASCADE;

-- +goose Down

DROP TABLE IF EXISTS tx_subtasks;
DROP TYPE IF EXISTS tx_subtask_status;
