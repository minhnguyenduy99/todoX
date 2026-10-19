package interfaces

import "context"

type TodoReadModel struct {
	Id          string
	Title       string
	Description string
	Changelog   string
	Status      string
	CreatedDate int64
	UpdatedDate int64
}

type ITodoReadModel interface {
	GetById(ctx context.Context, id string) (error, *TodoReadModel)
	List(ctx context.Context, status *string) (error, []TodoReadModel)
}
