package queries

import (
	"context"

	"todox-backend/internal/todo/domains"
	"todox-backend/internal/todo/interfaces"
)

type GetTodoById struct {
	ID string
}

type GetTodoByIdResult struct {
	ID          string
	Title       string
	Description string
	Changelog   string
	Status      domains.TodoStatus
	CreatedDate int64
	UpdatedDate int64
}

type GetTodoByIdHandler struct {
	ReadModel interfaces.ITodoReadModel
}

func (h *GetTodoByIdHandler) Handle(ctx context.Context, query *GetTodoById) (GetTodoByIdResult, error) {
	err, todo := h.ReadModel.GetById(ctx, query.ID)
	if err != nil {
		return GetTodoByIdResult{}, err
	}
	if todo == nil {
		return GetTodoByIdResult{}, domains.TodoNotFoundError{ID: query.ID}
	}

	return GetTodoByIdResult{
		ID:          todo.Id,
		Title:       todo.Title,
		Description: todo.Description,
		Changelog:   todo.Changelog,
		Status:      domains.TodoStatus(todo.Status),
		CreatedDate: todo.CreatedDate,
		UpdatedDate: todo.UpdatedDate,
	}, nil
}
