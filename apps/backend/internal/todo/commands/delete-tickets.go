package commands

import (
	"context"

	"todox-backend/internal/todo/domains"
	"todox-backend/internal/todo/interfaces"
)

type DeleteTickets struct {
	ID      string
	Tickets []domains.TicketId
}

type DeleteTicketsResult struct {
	ID          string
	Title       string
	Description string
	Changelog   string
	Status      domains.TodoStatus
	CreatedDate int64
	UpdatedDate int64
	Tickets     []domains.Ticket
}

type DeleteTicketsHandler struct {
	Repo interfaces.ITodoRepository
}

func (h *DeleteTicketsHandler) Handle(ctx context.Context, cmd *DeleteTickets) (DeleteTicketsResult, error) {
	err, updated := h.Repo.Update(ctx, cmd.ID, func(todo *domains.Todo) (error, *domains.Todo) {
		if err := todo.RemoveTickets(cmd.Tickets); err != nil {
			return err, nil
		}
		return nil, todo
	})
	if err != nil {
		return DeleteTicketsResult{}, err
	}

	return DeleteTicketsResult{
		ID:          updated.Id,
		Title:       updated.Title,
		Description: updated.Description,
		Changelog:   updated.Changelog,
		Status:      updated.Status,
		CreatedDate: updated.CreatedDate,
		UpdatedDate: updated.UpdatedDate,
		Tickets:     updated.Tickets,
	}, nil
}
