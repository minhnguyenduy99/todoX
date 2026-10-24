package adapters

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
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
        INSERT INTO todos (id, title, description, changelog, status, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, todo.Id, todo.Title, todo.Description, todo.Changelog, todo.Status,
		time.Unix(todo.CreatedDate, 0).UTC(),
		time.Unix(todo.UpdatedDate, 0).UTC())
	if err != nil {
		return err, nil
	}
	for _, ticket := range todo.Tickets {
		_, err = tx.Exec(ctx, `
            INSERT INTO associated_tickets (id, title, type, link, "todoId", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6)
        `, uuid.NewString(), ticket.Title, toDBTicketType(ticket.Type), ticket.Link, todo.Id,
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
		SELECT id, title, COALESCE(description, ''), COALESCE(changelog, ''), status,
		       EXTRACT(EPOCH FROM "createdAt")::bigint,
		       EXTRACT(EPOCH FROM "updatedAt")::bigint
		FROM todos
		WHERE ($1::text IS NULL OR status::text = $1)
		ORDER BY "updatedAt" DESC
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
	return nil, todos
}

func toReadModel(todo *domains.Todo) *interfaces.TodoReadModel {
	if todo == nil {
		return nil
	}
	return &interfaces.TodoReadModel{
		Id:          todo.Id,
		Title:       todo.Title,
		Description: todo.Description,
		Changelog:   todo.Changelog,
		Status:      string(todo.Status),
		CreatedDate: todo.CreatedDate,
		UpdatedDate: todo.UpdatedDate,
	}
}

func (repo *PostgresTodoRepository) getById(ctx context.Context, id string, forUpdate bool, tx pgx.Tx) (error, *domains.Todo) {
	query := `
		 SELECT id, title, COALESCE(description, ''), COALESCE(changelog, ''), status,
               EXTRACT(EPOCH FROM "createdAt")::bigint,
               EXTRACT(EPOCH FROM "updatedAt")::bigint
        FROM todos
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
		UPDATE todos
		SET title = $1, description = $2, changelog = $3, status = $4, "updatedAt" = $5
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
	tag, err := repo.Pool.Exec(ctx, `DELETE FROM todos WHERE id = $1`, id)
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
		SELECT title, type, link
		FROM associated_tickets
		WHERE "todoId" = $1
	`, todoID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tickets []domains.Ticket
	for rows.Next() {
		var ticket domains.Ticket
		var ticketType string
		if err := rows.Scan(&ticket.Title, &ticketType, &ticket.Link); err != nil {
			return nil, err
		}
		ticket.Type = fromDBTicketType(ticketType)
		if _, ticketID := domains.ParseTicketId(ticket.Link); ticketID.Code != "" {
			ticket.Id = ticketID
		}
		tickets = append(tickets, ticket)
	}
	return tickets, rows.Err()
}

func upsertTickets(ctx context.Context, tx pgx.Tx, todo *domains.Todo, updatedAt time.Time) error {
	for _, ticket := range todo.Tickets {
		tag, err := tx.Exec(ctx, `
			UPDATE associated_tickets
			SET title = $1, type = $2, "updatedAt" = $3
			WHERE "todoId" = $4 AND link = $5
		`, ticket.Title, toDBTicketType(ticket.Type), updatedAt, todo.Id, ticket.Link)
		if err != nil {
			return err
		}
		if tag.RowsAffected() > 0 {
			continue
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO associated_tickets (id, title, type, link, "todoId", "updatedAt")
			VALUES ($1, $2, $3, $4, $5, $6)
		`, uuid.NewString(), ticket.Title, toDBTicketType(ticket.Type), ticket.Link, todo.Id, updatedAt)
		if err != nil {
			return err
		}
	}
	return nil
}

func toDBTicketType(ticketType domains.TicketType) string {
	if strings.EqualFold(string(ticketType), string(domains.TicketTypeBug)) {
		return "bug"
	}
	return "feature"
}

func fromDBTicketType(ticketType string) domains.TicketType {
	if strings.EqualFold(ticketType, "bug") {
		return domains.TicketTypeBug
	}
	return domains.TicketTypeFeature
}
