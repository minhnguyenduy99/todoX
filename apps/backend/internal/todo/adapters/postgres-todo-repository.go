package adapters

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"todox-backend/internal/todo/domains"
	"todox-backend/internal/todo/interfaces"
)

var _ interfaces.ITodoRepository = (*PostgresTodoRepository)(nil)
var _ interfaces.ITodoReadModel = (*PostgresTodoRepository)(nil)

type PostgresTodoRepository struct {
	Pool *pgxpool.Pool
}

type pgxQueryer interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func (repo *PostgresTodoRepository) Create(ctx context.Context, handler func() *domains.Todo) (error, *domains.Todo) {
	todo := handler()

	tx, err := repo.Pool.Begin(ctx)
	if err != nil {
		return err, nil
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
        INSERT INTO tx_todos (id, title, description, changelog, todo_status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, todo.Id, todo.Title, todo.Description, todo.Changelog, todo.Status,
		time.Unix(todo.CreatedDate, 0).UTC(),
		time.Unix(todo.UpdatedDate, 0).UTC())
	if err != nil {
		return err, nil
	}
	for _, ticket := range todo.Tickets {
		_, err = tx.Exec(ctx, `
		INSERT INTO tx_associated_tickets (todo_id, source, id, title, type, link, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, todo.Id, ticket.Id.Source, ticket.Id.Code, ticket.Title, ticket.Type, ticket.Link,
			time.Unix(todo.UpdatedDate, 0).UTC())
		if err != nil {
			return err, nil
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err, nil
	}
	return nil, todo
}

func (repo *PostgresTodoRepository) GetById(ctx context.Context, id string) (error, *interfaces.TodoReadModel) {
	err, todo := repo.getById(ctx, id, false, nil)
	if err != nil {
		return err, nil
	}
	return nil, toReadModel(todo)
}

func (repo *PostgresTodoRepository) List(ctx context.Context, status *string) (error, []interfaces.TodoReadModel) {
	var statusArg any
	if status != nil {
		statusArg = *status
	}
	rows, err := repo.Pool.Query(ctx, `
		SELECT id, title, COALESCE(description, ''), COALESCE(changelog, ''), todo_status,
		       EXTRACT(EPOCH FROM created_at)::bigint,
		       EXTRACT(EPOCH FROM updated_at)::bigint
		FROM tx_todos
		WHERE ($1::text IS NULL OR todo_status::text = $1)
		ORDER BY updated_at DESC
	`, statusArg)
	if err != nil {
		return err, nil
	}
	defer rows.Close()

	todos := make([]interfaces.TodoReadModel, 0)
	for rows.Next() {
		var todo interfaces.TodoReadModel
		if err := rows.Scan(
			&todo.Id, &todo.Title, &todo.Description, &todo.Changelog, &todo.Status,
			&todo.CreatedDate, &todo.UpdatedDate,
		); err != nil {
			return err, nil
		}
		todos = append(todos, todo)
	}
	if err := rows.Err(); err != nil {
		return err, nil
	}
	if err := attachTickets(ctx, repo.Pool, todos); err != nil {
		return err, nil
	}
	return nil, todos
}

func toReadModel(todo *domains.Todo) *interfaces.TodoReadModel {
	if todo == nil {
		return nil
	}
	tickets := make([]interfaces.TicketReadModel, 0, len(todo.Tickets))
	for _, ticket := range todo.Tickets {
		tickets = append(tickets, interfaces.TicketReadModel{
			Id:     ticket.Id.Code,
			Source: ticket.Id.Source,
			Title:  ticket.Title,
			Type:   string(ticket.Type),
			Link:   ticket.Link,
		})
	}
	return &interfaces.TodoReadModel{
		Id:          todo.Id,
		Title:       todo.Title,
		Description: todo.Description,
		Changelog:   todo.Changelog,
		Status:      string(todo.Status),
		CreatedDate: todo.CreatedDate,
		UpdatedDate: todo.UpdatedDate,
		Tickets:     tickets,
	}
}

func (repo *PostgresTodoRepository) getById(ctx context.Context, id string, forUpdate bool, tx pgx.Tx) (error, *domains.Todo) {
	query := `
		 SELECT id, title, COALESCE(description, ''), COALESCE(changelog, ''), todo_status,
               EXTRACT(EPOCH FROM created_at)::bigint,
               EXTRACT(EPOCH FROM updated_at)::bigint
        FROM tx_todos
        WHERE id = $1`
	db := pgxQueryer(repo.Pool)
	if forUpdate {
		if tx == nil {
			return fmt.Errorf("forUpdate requires a transaction"), nil
		}
		query += ` FOR UPDATE`
		db = tx
	}
	row := db.QueryRow(ctx, query, id)

	var todo domains.Todo
	err := row.Scan(
		&todo.Id, &todo.Title, &todo.Description, &todo.Changelog, &todo.Status,
		&todo.CreatedDate, &todo.UpdatedDate,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domains.TodoNotFoundError{ID: id}, nil
	}
	if err != nil {
		return err, nil
	}

	tickets, err := listTickets(ctx, db, id)
	if err != nil {
		return err, nil
	}
	todo.Tickets = tickets
	return nil, &todo
}

func (repo *PostgresTodoRepository) Update(ctx context.Context, todoId string, handler func(todo *domains.Todo) (error, *domains.Todo)) (error, *domains.Todo) {
	tx, err := repo.Pool.Begin(ctx)
	if err != nil {
		return err, nil
	}
	defer tx.Rollback(ctx)

	err, todo := repo.getById(ctx, todoId, true, tx)
	if err != nil {
		return err, nil
	}

	err, todo = handler(todo)
	if err != nil {
		return err, nil
	}
	if todo == nil {
		return fmt.Errorf("todo is nil"), nil
	}

	updatedAt := time.Unix(todo.UpdatedDate, 0).UTC()
	tag, err := tx.Exec(ctx, `
		UPDATE tx_todos
		SET title = $1, description = $2, changelog = $3, todo_status = $4, updated_at = $5
		WHERE id = $6
	`, todo.Title, todo.Description, todo.Changelog, todo.Status, updatedAt, todo.Id)
	if err != nil {
		return err, nil
	}
	if tag.RowsAffected() == 0 {
		return domains.TodoNotFoundError{ID: todo.Id}, nil
	}

	if err := upsertTickets(ctx, tx, todo, updatedAt); err != nil {
		return err, nil
	}
	if err := tx.Commit(ctx); err != nil {
		return err, nil
	}
	return nil, todo
}

func (repo *PostgresTodoRepository) DeleteById(ctx context.Context, id string) error {
	tag, err := repo.Pool.Exec(ctx, `DELETE FROM tx_todos WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domains.TodoNotFoundError{ID: id}
	}
	return nil
}

func listTickets(ctx context.Context, db pgxQueryer, todoID string) ([]domains.Ticket, error) {
	rows, err := db.Query(ctx, `
		SELECT source, id, title, type, link
		FROM tx_associated_tickets
		WHERE todo_id = $1
		ORDER BY source, id
	`, todoID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tickets []domains.Ticket
	for rows.Next() {
		var ticket domains.Ticket
		if err := rows.Scan(&ticket.Id.Source, &ticket.Id.Code, &ticket.Title, &ticket.Type, &ticket.Link); err != nil {
			return nil, err
		}
		tickets = append(tickets, ticket)
	}
	return tickets, rows.Err()
}

func upsertTickets(ctx context.Context, tx pgx.Tx, todo *domains.Todo, updatedAt time.Time) error {
	for _, ticket := range todo.Tickets {
		_, err := tx.Exec(ctx, `
			INSERT INTO tx_associated_tickets (todo_id, source, id, title, type, link, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (todo_id, source, id) DO UPDATE
			SET title = EXCLUDED.title,
			    type = EXCLUDED.type,
			    link = EXCLUDED.link,
			    updated_at = EXCLUDED.updated_at
		`, todo.Id, ticket.Id.Source, ticket.Id.Code, ticket.Title, ticket.Type, ticket.Link, updatedAt)
		if err != nil {
			return err
		}
	}
	return nil
}

func attachTickets(ctx context.Context, db pgxQueryer, todos []interfaces.TodoReadModel) error {
	if len(todos) == 0 {
		return nil
	}
	ids := make([]string, len(todos))
	indexByID := make(map[string]int, len(todos))
	for i := range todos {
		ids[i] = todos[i].Id
		indexByID[todos[i].Id] = i
		todos[i].Tickets = []interfaces.TicketReadModel{}
	}
	rows, err := db.Query(ctx, `
		SELECT todo_id, source, id, title, type, link
		FROM tx_associated_tickets
		WHERE todo_id = ANY($1::text[])
		ORDER BY source, id
	`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var todoID string
		var ticket interfaces.TicketReadModel
		if err := rows.Scan(&todoID, &ticket.Source, &ticket.Id, &ticket.Title, &ticket.Type, &ticket.Link); err != nil {
			return err
		}
		index, ok := indexByID[todoID]
		if !ok {
			continue
		}
		todos[index].Tickets = append(todos[index].Tickets, ticket)
	}
	return rows.Err()
}
