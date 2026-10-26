package queries

import (
	"context"

	"todox-backend/internal/todo/domains"
	"todox-backend/internal/todo/interfaces"
)

type GetTodoById struct {
	ID string
}

type GetTodoByIdHandler struct {
	ReadModel interfaces.ITodoReadModel
}

func (h *GetTodoByIdHandler) Handle(ctx context.Context, query *GetTodoById) (*interfaces.TodoReadModel, error) {
	err, todo := h.ReadModel.GetById(ctx, query.ID)
	if err != nil {
		return nil, err
	}
	if todo == nil {
		return nil, domains.TodoNotFoundError{ID: query.ID}
	}
	return todo, nil
}
