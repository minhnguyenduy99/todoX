package commands

import (
	"context"

	"todox-backend/internal/todo/interfaces"
)

type DeleteTodo struct {
	ID string
}

type DeleteTodoHandler struct {
	Repo interfaces.ITodoRepository
}

func (h *DeleteTodoHandler) Handle(ctx context.Context, cmd *DeleteTodo) error {
	return h.Repo.DeleteById(ctx, cmd.ID)
}
