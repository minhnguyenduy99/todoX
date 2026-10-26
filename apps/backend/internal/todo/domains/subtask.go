package domains

import (
	"strings"

	"todox-backend/internal/shared"

	"github.com/google/uuid"
)

type SubtaskStatus string

const (
	SubtaskStatusNotStarted SubtaskStatus = "NOT_STARTED"
	SubtaskStatusInProgress SubtaskStatus = "IN_PROGRESS"
	SubtaskStatusCompleted  SubtaskStatus = "COMPLETED"
)

type Subtask struct {
	Id     string
	Title  string
	Status SubtaskStatus
}

type NewSubtask struct {
	Id     string
	Title  string
	Status *SubtaskStatus
}

func newSubtask(data NewSubtask) (shared.BaseDomainError, Subtask) {
	err, subtask := parseSubtask(data)
	if err != nil {
		return err, Subtask{}
	}
	subtask.Id = uuid.New().String()
	return nil, subtask
}

func parseSubtask(data NewSubtask) (shared.BaseDomainError, Subtask) {
	title := strings.TrimSpace(data.Title)
	if title == "" {
		return InvalidSubtaskTitleError{}, Subtask{}
	}
	status := SubtaskStatusNotStarted
	if data.Status != nil {
		if !validSubtaskStatus(*data.Status) {
			return InvalidSubtaskStatusError{Status: string(*data.Status)}, Subtask{}
		}
		status = *data.Status
	}
	return nil, Subtask{
		Id:     strings.TrimSpace(data.Id),
		Title:  title,
		Status: status,
	}
}

func (s *Subtask) updateInfo(title string, status SubtaskStatus) {
	s.Title = title
	s.Status = status
}

func missingSubtaskIds(subtasks []Subtask, ids []string) []string {
	existing := make(map[string]struct{}, len(subtasks))
	for _, subtask := range subtasks {
		existing[subtask.Id] = struct{}{}
	}
	var missing []string
	seen := make(map[string]struct{})
	for _, id := range ids {
		if _, ok := existing[id]; ok {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		missing = append(missing, id)
	}
	return missing
}

func validSubtaskStatus(status SubtaskStatus) bool {
	switch status {
	case SubtaskStatusNotStarted, SubtaskStatusInProgress, SubtaskStatusCompleted:
		return true
	default:
		return false
	}
}
