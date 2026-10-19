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
}

type CreateTodoResult struct {
	ID          string             `json:"id"`
	Title       string             `json:"title"`
	Description string             `json:"description"`
	Changelog   string             `json:"changelog"`
	Status      domains.TodoStatus `json:"status"`
	CreatedDate int64              `json:"created_date"`
	UpdatedDate int64              `json:"updated_date"`
}

type CreateTodoHandler struct {
	Repo interfaces.ITodoRepository
}

func (h *CreateTodoHandler) Handle(ctx context.Context, cmd *CreateTodo) (CreateTodoResult, error) {
	err, todo := h.Repo.Create(ctx, func() *domains.Todo {
		todo := domains.CreateNew(domains.NewTodo{
			Title:       cmd.Title,
			Description: cmd.Description,
			Changelog:   cmd.Changelog,
			Status:      cmd.Status,
		})
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
	}, nil
}
