package commands

import (
	"context"

	"todox-backend/internal/todo/domains"
	"todox-backend/internal/todo/interfaces"
)

type CreateTodo struct {
	Title       string             `json:"title"`
	Description string             `json:"description"`
	Changelog   string             `json:"changelog"`
	Status      domains.TodoStatus `json:"status"`
	Tickets     []domains.NewTicket
}

type CreateTodoResult struct {
	ID          string             `json:"id"`
	Title       string             `json:"title"`
	Description string             `json:"description"`
	Changelog   string             `json:"changelog"`
	Status      domains.TodoStatus `json:"status"`
	CreatedDate int64              `json:"created_date"`
	UpdatedDate int64              `json:"updated_date"`
	Tickets     []domains.Ticket
}

type CreateTodoHandler struct {
	Repo interfaces.ITodoRepository
}

func (h *CreateTodoHandler) Handle(ctx context.Context, cmd *CreateTodo) (CreateTodoResult, error) {
	domainErr, todo := domains.CreateNew(domains.NewTodo{
		Title:       cmd.Title,
		Description: cmd.Description,
		Changelog:   cmd.Changelog,
		Status:      cmd.Status,
		Tickets:     cmd.Tickets,
	})
	if domainErr != nil {
		return CreateTodoResult{}, domainErr
	}

	err, todo := h.Repo.Create(ctx, func() *domains.Todo {
		return todo
	})
	if err != nil {
		return CreateTodoResult{}, err
	}

	return CreateTodoResult{
		ID:          todo.Id,
		Title:       todo.Title,
		Description: todo.Description,
		Changelog:   todo.Changelog,
		Status:      todo.Status,
		CreatedDate: todo.CreatedDate,
		UpdatedDate: todo.UpdatedDate,
		Tickets:     todo.Tickets,
	}, nil
}
