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
