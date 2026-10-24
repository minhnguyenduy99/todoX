package queries

import (
	"todox-backend/internal/todo/domains"
	"todox-backend/internal/todo/interfaces"
)

func ticketsFromReadModel(tickets []interfaces.TicketReadModel) []domains.Ticket {
	mapped := make([]domains.Ticket, 0, len(tickets))
	for _, ticket := range tickets {
		mapped = append(mapped, domains.Ticket{
			Id:    domains.TicketId{Source: ticket.Source, Code: ticket.Id},
			Title: ticket.Title,
			Type:  domains.TicketType(ticket.Type),
			Link:  ticket.Link,
		})
	}
	return mapped
}
