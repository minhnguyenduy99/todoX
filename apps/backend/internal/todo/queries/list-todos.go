package queries

import (
	"context"

	"todox-backend/internal/todo/domains"
	"todox-backend/internal/todo/interfaces"
)

type ListTodos struct {
	Status string
}

type ListTodosItem struct {
	ID          string
	Title       string
	Description string
	Changelog   string
	Status      domains.TodoStatus
	CreatedDate int64
	UpdatedDate int64
}

type ListTodosResult struct {
	TotalCount int
	Items      []ListTodosItem
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

	items := make([]ListTodosItem, 0, len(todos))
	for _, todo := range todos {
		items = append(items, ListTodosItem{
			ID:          todo.Id,
			Title:       todo.Title,
			Description: todo.Description,
			Changelog:   todo.Changelog,
			Status:      domains.TodoStatus(todo.Status),
			CreatedDate: todo.CreatedDate,
			UpdatedDate: todo.UpdatedDate,
		})
	}

	return ListTodosResult{
		TotalCount: len(items),
		Items:      items,
	}, nil
}
