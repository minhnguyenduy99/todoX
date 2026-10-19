package domains

import (
	"fmt"
	"strings"
	"time"
	"todox-backend/internal/shared"

	"github.com/google/uuid"
)

type TicketType string

const (
	TicketTypeFeature TicketType = "FEATURE"
	TicketTypeBug     TicketType = "BUG"
)

type TicketId struct {
	Source string
	Code   string
}

type Ticket struct {
	Id    TicketId
	Link  string
	Type  TicketType
	Title string
}

type NewTicket struct {
	Link  string
	Type  TicketType
	Title string
}

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
	Tickets     []Ticket
}

type UpdatedTodoInfo struct {
	Title       string
	Description string
	Changelog   string
	Tickets     []NewTicket
}

func (ticketIdA *TicketId) Equals(ticketIdB *TicketId) bool {
	return ticketIdA.Code == ticketIdB.Code && ticketIdA.Source == ticketIdB.Source
}

func (t *Todo) UpdateStatus(newStatus TodoStatus) {
	t.Status = newStatus
	t.UpdatedDate = time.Now().Unix()
}

func (t *Todo) UpdateInfo(updatedInfo UpdatedTodoInfo) shared.BaseDomainError {
	t.Title = updatedInfo.Title
	t.Description = updatedInfo.Description
	t.Changelog = updatedInfo.Changelog
	for _, ticket := range updatedInfo.Tickets {
		if err := t.AddTicket(ticket); err != nil {
			return err
		}
	}
	t.UpdatedDate = time.Now().Unix()
	return nil
}

func (t *Todo) AddTicket(data NewTicket) shared.BaseDomainError {
	var err, ticketId = ParseTicketId(data.Link)
	if err != nil {
		return InvalidTicketIdFormatError{TicketId: data.Link}
	}
	for _, d := range t.Tickets {
		if d.Id.Equals(&ticketId) {
			continue
		}
	}
	t.Tickets = append(t.Tickets, Ticket{
		Id:    ticketId,
		Title: data.Title,
		Link:  data.Link,
		Type:  data.Type,
	})
	return nil
}

func CreateNew(todo NewTodo) *Todo {
	createdDate := time.Now().Unix()
	return &Todo{
		Id:          uuid.New().String(),
		Title:       todo.Title,
		Description: todo.Description,
		Changelog:   todo.Changelog,
		CreatedDate: createdDate,
		UpdatedDate: createdDate,
		Status:      todo.Status,
	}
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

func ParseTicketId(link string) (error, TicketId) {
	// Example of Jira URL: https://your-domain.atlassian.net/browse/PROJ-1234
	parts := strings.Split(link, "/")
	if len(parts) == 0 {
		return fmt.Errorf("cannot parse ticket id from link: %q", link), TicketId{}
	}
	ticketId := parts[len(parts)-1]
	if ticketId == "" && len(parts) > 1 {
		ticketId = parts[len(parts)-2]
	}
	// Minimal validation: TicketID should be in format PROJECT-123
	if len(ticketId) < 2 || !strings.Contains(ticketId, "-") {
		return fmt.Errorf("cannot parse ticket id from link: %q", link), TicketId{}
	}
	return nil, TicketId{
		Source: "JIRA",
		Code:   ticketId,
	}
}
