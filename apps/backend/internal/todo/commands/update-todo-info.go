package commands

import (
	"context"

	"todox-backend/internal/todo/domains"
	"todox-backend/internal/todo/interfaces"
)

type UpdateTodoInfo struct {
	ID          string
	Title       string
	Description string
	Changelog   string
}

type UpdateTodoInfoResult struct {
	ID          string
	Title       string
	Description string
	Changelog   string
	UpdatedDate int64
}

type UpdateTodoInfoHandler struct {
	Repo interfaces.ITodoRepository
}

func (h *UpdateTodoInfoHandler) Handle(ctx context.Context, cmd *UpdateTodoInfo) (UpdateTodoInfoResult, error) {
	err, updatedTodoItem := h.Repo.Update(ctx, cmd.ID, func(todoItem *domains.Todo) (error, *domains.Todo) {
		var updateError = todoItem.UpdateInfo(domains.UpdatedTodoInfo{
			Title:       cmd.Title,
			Description: cmd.Description,
			Changelog:   cmd.Changelog,
			Tickets:     []domains.NewTicket{},
		})
		if updateError != nil {
			return updateError, nil
		}
		return nil, todoItem
	})

	if err != nil {
		return UpdateTodoInfoResult{}, err
	}

	return UpdateTodoInfoResult{
		ID:          updatedTodoItem.Id,
		Title:       updatedTodoItem.Title,
		Description: updatedTodoItem.Description,
		Changelog:   updatedTodoItem.Changelog,
		UpdatedDate: updatedTodoItem.UpdatedDate,
	}, nil
}
