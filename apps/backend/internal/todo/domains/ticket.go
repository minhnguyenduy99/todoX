package domains

import (
	"strings"
	"time"

	"todox-backend/internal/shared"
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
	Id     string
	Source string
	Link   string
	Type   TicketType
	Title  string
}

func (ticketIdA *TicketId) Equals(ticketIdB *TicketId) bool {
	return ticketIdA.Code == ticketIdB.Code && ticketIdA.Source == ticketIdB.Source
}

func (t *Todo) ReplaceTickets(tickets []NewTicket) shared.BaseDomainError {
	staged := Todo{}
	for _, ticket := range tickets {
		if err := staged.AddTicket(ticket); err != nil {
			return err
		}
	}
	t.Tickets = staged.Tickets
	return nil
}

func (t *Todo) RemoveTickets(ids []TicketId) shared.BaseDomainError {
	wanted := make([]TicketId, 0, len(ids))
	for _, id := range ids {
		source := strings.TrimSpace(id.Source)
		code := strings.TrimSpace(id.Code)
		if code == "" {
			return InvalidTicketIdFormatError{TicketId: id.Code}
		}
		if source == "" {
			return InvalidTicketIdFormatError{TicketId: id.Source}
		}
		wanted = append(wanted, TicketId{Source: source, Code: code})
	}

	kept := make([]Ticket, 0, len(t.Tickets))
	removed := false
	for _, ticket := range t.Tickets {
		drop := false
		for i := range wanted {
			if ticket.Id.Equals(&wanted[i]) {
				drop = true
				break
			}
		}
		if drop {
			removed = true
			continue
		}
		kept = append(kept, ticket)
	}
	if !removed {
		return nil
	}
	t.Tickets = kept
	t.UpdatedDate = time.Now().Unix()
	return nil
}

func (t *Todo) AddTicket(data NewTicket) shared.BaseDomainError {
	err, ticket := newTicket(data)
	if err != nil {
		return err
	}
	for i := range t.Tickets {
		if t.Tickets[i].Id.Equals(&ticket.Id) {
			t.Tickets[i] = ticket
			return nil
		}
	}
	t.Tickets = append(t.Tickets, ticket)
	return nil
}

func newTicket(data NewTicket) (shared.BaseDomainError, Ticket) {
	ticketID := strings.TrimSpace(data.Id)
	source := strings.TrimSpace(data.Source)
	if ticketID == "" {
		return InvalidTicketIdFormatError{TicketId: data.Id}, Ticket{}
	}
	if source == "" {
		return InvalidTicketIdFormatError{TicketId: data.Source}, Ticket{}
	}
	switch data.Type {
	case TicketTypeFeature, TicketTypeBug:
	default:
		return InvalidTicketTypeError{Type: string(data.Type)}, Ticket{}
	}
	return nil, Ticket{
		Id:    TicketId{Source: source, Code: ticketID},
		Title: data.Title,
		Link:  data.Link,
		Type:  data.Type,
	}
}
