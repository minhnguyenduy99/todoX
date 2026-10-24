-- Todo aggregate tables used by the Go API.
-- Tickets belong to a todo and are written in the same transaction as the parent row.
-- The tables from 00001_init.sql stay in place; this migration adds the tx_ copies
-- the application reads and writes.
-- A ticket's primary key is (todo_id, source, id).

-- +goose Up

CREATE TYPE tx_ticket_type AS ENUM ('FEATURE', 'BUG');

CREATE TABLE tx_todos (
    id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    changelog TEXT,
    todo_status "TodoStatus" NOT NULL DEFAULT 'NOT_STARTED',
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT tx_todos_pkey PRIMARY KEY (id)
);

CREATE TABLE tx_associated_tickets (
    todo_id TEXT NOT NULL,
    source TEXT NOT NULL,
    id TEXT NOT NULL,
    title TEXT NOT NULL,
    type tx_ticket_type NOT NULL,
    link TEXT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT tx_associated_tickets_pkey PRIMARY KEY (todo_id, source, id)
);

ALTER TABLE tx_associated_tickets
  ADD CONSTRAINT tx_associated_tickets_todo_id_fkey
  FOREIGN KEY (todo_id) REFERENCES tx_todos (id) ON DELETE CASCADE ON UPDATE CASCADE;

-- +goose Down

DROP TABLE IF EXISTS tx_associated_tickets;
DROP TABLE IF EXISTS tx_todos;
DROP TYPE IF EXISTS tx_ticket_type;
