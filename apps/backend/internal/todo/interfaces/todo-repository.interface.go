package interfaces

import (
	"context"
	"todox-backend/internal/todo/domains"
)

type ITodoRepository interface {
	Create(ctx context.Context, handler func() *domains.Todo) (error, *domains.Todo)
	Update(ctx context.Context, todoId string, handler func(todo *domains.Todo) (error, *domains.Todo)) (error, *domains.Todo)
	DeleteById(ctx context.Context, id string) error
}
