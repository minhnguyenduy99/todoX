package domains

import (
	"fmt"
	"time"

	"todox-backend/internal/shared"

	"github.com/google/uuid"
)

type TodoStatus string

const (
	TodoStatusNotStarted     TodoStatus = "NOT_STARTED"
	TodoStatusInProgress     TodoStatus = "IN_PROGRESS"
	TodoStatusTesting        TodoStatus = "TESTING"
	TodoStatusWaitForStaging TodoStatus = "WAIT_FOR_STAGING"
	TodoStatusCompleted      TodoStatus = "COMPLETED"
)

type Todo struct {
	Id          string
	Title       string
	Description string
	Changelog   string
	Status      TodoStatus
	CreatedDate int64
	UpdatedDate int64
	Tickets     []Ticket
}

type NewTodo struct {
	Title       string
	Description string
	Changelog   string
	Status      TodoStatus
	Tickets     []NewTicket
}

type UpdatedTodoInfo struct {
	Title       string
	Description string
	Changelog   string
	Tickets     []NewTicket
}

func (t *Todo) UpdateStatus(newStatus TodoStatus) {
	t.Status = newStatus
	t.UpdatedDate = time.Now().Unix()
}

func (t *Todo) UpdateInfo(updatedInfo UpdatedTodoInfo) shared.BaseDomainError {
	staged := Todo{Tickets: append([]Ticket(nil), t.Tickets...)}
	for _, ticket := range updatedInfo.Tickets {
		if err := staged.AddTicket(ticket); err != nil {
			return err
		}
	}
	t.Tickets = staged.Tickets
	t.Title = updatedInfo.Title
	t.Description = updatedInfo.Description
	t.Changelog = updatedInfo.Changelog
	t.UpdatedDate = time.Now().Unix()
	return nil
}

func CreateNew(todo NewTodo) (shared.BaseDomainError, *Todo) {
	createdDate := time.Now().Unix()
	created := &Todo{
		Id:          uuid.New().String(),
		Title:       todo.Title,
		Description: todo.Description,
		Changelog:   todo.Changelog,
		CreatedDate: createdDate,
		UpdatedDate: createdDate,
		Status:      todo.Status,
	}
	if err := created.ReplaceTickets(todo.Tickets); err != nil {
		return err, nil
	}
	return nil, created
}

func ParseTodoStatus(status string) (TodoStatus, error) {
	todoStatus := TodoStatus(status)
	switch todoStatus {
	case TodoStatusInProgress,
		TodoStatusTesting,
		TodoStatusWaitForStaging,
		TodoStatusCompleted:
		return todoStatus, nil
	default:
		return "", fmt.Errorf("invalid todo status %q", status)
	}
}
