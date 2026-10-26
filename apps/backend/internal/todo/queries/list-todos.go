package queries

import (
	"context"

	"todox-backend/internal/todo/interfaces"
)

type ListTodos struct {
	Status string
}

type ListTodosResult struct {
	TotalCount int
	Items      []interfaces.TodoReadModel
}

type ListTodosHandler struct {
	ReadModel interfaces.ITodoReadModel
}

func (h *ListTodosHandler) Handle(ctx context.Context, query *ListTodos) (ListTodosResult, error) {
	var status *string
	if query.Status != "" {
		status = &query.Status
	}

	err, todos := h.ReadModel.List(ctx, status)
	if err != nil {
		return ListTodosResult{}, err
	}

	return ListTodosResult{
		TotalCount: len(todos),
		Items:      todos,
	}, nil
}
