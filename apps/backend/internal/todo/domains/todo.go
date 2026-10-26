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
	Subtasks    []Subtask
}

type NewTodo struct {
	Title       string
	Description string
	Changelog   string
	Status      TodoStatus
	Tickets     []NewTicket
	Subtasks    []NewSubtask
}

type UpdatedTodoInfo struct {
	Title       string
	Description string
	Changelog   string
	Tickets     []NewTicket
	Subtasks    []NewSubtask
}

func (t *Todo) UpdateStatus(newStatus TodoStatus) {
	t.Status = newStatus
	t.UpdatedDate = time.Now().Unix()
}

func (t *Todo) UpdateInfo(updatedInfo UpdatedTodoInfo) shared.BaseDomainError {
	for _, ticket := range updatedInfo.Tickets {
		if err := t.AddTicket(ticket); err != nil {
			return err
		}
	}
	for _, subtask := range updatedInfo.Subtasks {
		if subtask.Id == "" {
			if err := t.createSubtask(subtask); err != nil {
				return err
			}
			continue
		}
		var matchedSubtask *Subtask
		for i := range t.Subtasks {
			if t.Subtasks[i].Id == subtask.Id {
				matchedSubtask = &t.Subtasks[i]
				break
			}
		}
		if matchedSubtask == nil {
			return SubtaskNotFoundError{MissingIds: []string{subtask.Id}}
		}
		status := matchedSubtask.Status
		if subtask.Status != nil {
			status = *subtask.Status
		}
		matchedSubtask.updateInfo(subtask.Title, status)
	}
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
	for _, subtask := range todo.Subtasks {
		if err := created.createSubtask(subtask); err != nil {
			return err, nil
		}
	}
	return nil, created
}

func (t *Todo) RemoveSubtasks(ids []string) shared.BaseDomainError {
	wanted := make([]string, 0, len(ids))
	drop := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		if _, ok := drop[id]; ok {
			continue
		}
		drop[id] = struct{}{}
		wanted = append(wanted, id)
	}

	missing := missingSubtaskIds(t.Subtasks, wanted)
	if len(missing) > 0 {
		return SubtaskNotFoundError{MissingIds: missing}
	}

	kept := make([]Subtask, 0, len(t.Subtasks))
	for _, subtask := range t.Subtasks {
		if _, ok := drop[subtask.Id]; ok {
			continue
		}
		kept = append(kept, subtask)
	}
	t.Subtasks = kept
	t.UpdatedDate = time.Now().Unix()
	return nil
}

func (t *Todo) createSubtask(data NewSubtask) shared.BaseDomainError {
	err, subtask := newSubtask(data)
	if err != nil {
		return err
	}
	t.Subtasks = append(t.Subtasks, subtask)
	return nil
}

func (t *Todo) updateSubtask(data NewSubtask) shared.BaseDomainError {
	err, subtask := parseSubtask(data)
	if err != nil {
		return err
	}
	if subtask.Id == "" {
		return InvalidSubtaskIdError{}
	}
	for i := range t.Subtasks {
		if t.Subtasks[i].Id != subtask.Id {
			continue
		}
		t.Subtasks[i].Title = subtask.Title
		if data.Status != nil {
			t.Subtasks[i].Status = subtask.Status
		}
		return nil
	}
	return SubtaskNotFoundError{MissingIds: []string{subtask.Id}}
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
