package interfaces

import "context"

type TicketReadModel struct {
	Id     string
	Source string
	Title  string
	Type   string
	Link   string
}

type SubtaskReadModel struct {
	Id     string
	Title  string
	Status string
}

type TodoReadModel struct {
	Id          string
	Title       string
	Description string
	Changelog   string
	Status      string
	CreatedDate int64
	UpdatedDate int64
	Tickets     []TicketReadModel
	Subtasks    []SubtaskReadModel
}

type ITodoReadModel interface {
	GetById(ctx context.Context, id string) (error, *TodoReadModel)
	List(ctx context.Context, status *string) (error, []TodoReadModel)
}
