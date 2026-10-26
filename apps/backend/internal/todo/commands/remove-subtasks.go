package commands

import (
	"context"

	"todox-backend/internal/todo/domains"
	"todox-backend/internal/todo/interfaces"
)

type RemoveSubtasks struct {
	ID       string
	Subtasks []string
}

type RemoveSubtasksResult struct {
	ID          string
	Title       string
	Description string
	Changelog   string
	Status      domains.TodoStatus
	CreatedDate int64
	UpdatedDate int64
	Tickets     []domains.Ticket
	Subtasks    []domains.Subtask
}

type RemoveSubtasksHandler struct {
	Repo interfaces.ITodoRepository
}

func (h *RemoveSubtasksHandler) Handle(ctx context.Context, cmd *RemoveSubtasks) (RemoveSubtasksResult, error) {
	err, updated := h.Repo.Update(ctx, cmd.ID, func(todo *domains.Todo) (error, *domains.Todo) {
		if err := todo.RemoveSubtasks(cmd.Subtasks); err != nil {
			return err, nil
		}
		return nil, todo
	})
	if err != nil {
		return RemoveSubtasksResult{}, err
	}

	return RemoveSubtasksResult{
		ID:          updated.Id,
		Title:       updated.Title,
		Description: updated.Description,
		Changelog:   updated.Changelog,
		Status:      updated.Status,
		CreatedDate: updated.CreatedDate,
		UpdatedDate: updated.UpdatedDate,
		Tickets:     updated.Tickets,
		Subtasks:    updated.Subtasks,
	}, nil
}
