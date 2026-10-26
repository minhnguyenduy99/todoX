package domains

import "fmt"

type InvalidTicketIdFormatError struct {
	TicketId string
}

func (e InvalidTicketIdFormatError) Get() (string, string) {
	return "INVALID_TICKET_ID_FORMAT", fmt.Sprintf("Invalid ticket Id format: %s", e.TicketId)
}

func (e InvalidTicketIdFormatError) Error() string {
	_, message := e.Get()
	return message
}

type InvalidTicketTypeError struct {
	Type string
}

func (e InvalidTicketTypeError) Get() (string, string) {
	return "INVALID_TICKET_TYPE", fmt.Sprintf("Invalid ticket type: %s", e.Type)
}

func (e InvalidTicketTypeError) Error() string {
	_, message := e.Get()
	return message
}

type InvalidSubtaskIdError struct{}

func (e InvalidSubtaskIdError) Get() (string, string) {
	return "INVALID_SUBTASK_ID", "Invalid subtask id"
}

func (e InvalidSubtaskIdError) Error() string {
	_, message := e.Get()
	return message
}

type InvalidSubtaskTitleError struct{}

func (e InvalidSubtaskTitleError) Get() (string, string) {
	return "INVALID_SUBTASK_TITLE", "Invalid subtask title"
}

func (e InvalidSubtaskTitleError) Error() string {
	_, message := e.Get()
	return message
}

type InvalidSubtaskStatusError struct {
	Status string
}

func (e InvalidSubtaskStatusError) Get() (string, string) {
	return "INVALID_SUBTASK_STATUS", fmt.Sprintf("Invalid subtask status: %s", e.Status)
}

func (e InvalidSubtaskStatusError) Error() string {
	_, message := e.Get()
	return message
}

type SubtaskNotFoundError struct {
	MissingIds []string
}

func (e SubtaskNotFoundError) Get() (string, string) {
	return "SUBTASK_NOT_FOUND", "Subtasks not found"
}

func (e SubtaskNotFoundError) Error() string {
	_, message := e.Get()
	return message
}

type TodoNotFoundError struct {
	ID string
}

func (e TodoNotFoundError) Get() (string, string) {
	return "TODO_NOT_FOUND", fmt.Sprintf("Todo %s not found", e.ID)
}

func (e TodoNotFoundError) Error() string {
	_, message := e.Get()
	return message
}
