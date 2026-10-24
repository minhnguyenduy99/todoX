package adapters

import (
	"context"
	"fmt"
	"sort"

	"todox-backend/internal/todo/domains"
	"todox-backend/internal/todo/interfaces"
)

var _ interfaces.ITodoRepository = (*InMemRepository)(nil)
var _ interfaces.ITodoReadModel = (*InMemRepository)(nil)

type InMemRepository struct{}

var todoList = []domains.Todo{}

func (repo *InMemRepository) Create(ctx context.Context, handler func() *domains.Todo) (error, *domains.Todo) {
	item := handler()
	todoList = append(todoList, *item)
	return nil, item
}

func (repo *InMemRepository) GetById(ctx context.Context, id string) (error, *interfaces.TodoReadModel) {
	err, todo := repo.findById(id)
	if err != nil {
		return err, nil
	}
	return nil, toReadModel(todo)
}

func (repo *InMemRepository) List(ctx context.Context, status *string) (error, []interfaces.TodoReadModel) {
	items := make([]interfaces.TodoReadModel, 0)
	for _, todo := range todoList {
		if status != nil && string(todo.Status) != *status {
			continue
		}
		items = append(items, *toReadModel(&todo))
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].UpdatedDate > items[j].UpdatedDate
	})
	return nil, items
}

func (repo *InMemRepository) findById(id string) (error, *domains.Todo) {
	for i := range todoList {
		if todoList[i].Id == id {
			return nil, &todoList[i]
		}
	}
	return domains.TodoNotFoundError{ID: id}, nil
}

func (repo *InMemRepository) Update(ctx context.Context, todoId string, handler func(todo *domains.Todo) (error, *domains.Todo)) (error, *domains.Todo) {
	err, existing := repo.findById(todoId)
	if err != nil {
		return err, nil
	}
	err, todo := handler(existing)
	if err != nil {
		return err, nil
	}
	if todo == nil {
		return fmt.Errorf("todo is nil"), nil
	}
	for i := range todoList {
		if todoList[i].Id == todo.Id {
			todoList[i] = *todo
			return nil, todo
		}
	}
	return err, nil
}

func (repo *InMemRepository) DeleteById(ctx context.Context, id string) error {
	for i := range todoList {
		if todoList[i].Id == id {
			todoList = append(todoList[:i], todoList[i+1:]...)
			return nil
		}
	}
	return domains.TodoNotFoundError{ID: id}
}
