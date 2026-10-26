package domains

import (
	"strings"

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

func newSubtask(data NewSubtask) Subtask {
	subtask := parseSubtask(data)
	subtask.Id = uuid.New().String()
	return subtask
}

func parseSubtask(data NewSubtask) Subtask {
	status := SubtaskStatusNotStarted
	if data.Status != nil {
		status = *data.Status
	}
	return Subtask{
		Id:     strings.TrimSpace(data.Id),
		Title:  strings.TrimSpace(data.Title),
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
