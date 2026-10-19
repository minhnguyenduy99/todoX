package adapters

import (
	"context"
	"testing"

	"todox-backend/internal/todo/domains"
)

func TestInMemListFiltersAndSortsByUpdatedDateDesc(t *testing.T) {
	todoList = []domains.Todo{
		{Id: "older", Title: "older", Status: domains.TodoStatusNotStarted, UpdatedDate: 10},
		{Id: "newer", Title: "newer", Status: domains.TodoStatusInProgress, UpdatedDate: 30},
		{Id: "middle", Title: "middle", Status: domains.TodoStatusNotStarted, UpdatedDate: 20},
	}
	t.Cleanup(func() { todoList = nil })

	repo := &InMemRepository{}
	err, items := repo.List(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 3 || items[0].Id != "newer" || items[1].Id != "middle" || items[2].Id != "older" {
		t.Fatalf("unexpected order: %+v", items)
	}

	status := string(domains.TodoStatusNotStarted)
	err, filtered := repo.List(context.Background(), &status)
	if err != nil {
		t.Fatal(err)
	}
	if len(filtered) != 2 || filtered[0].Id != "middle" || filtered[1].Id != "older" {
		t.Fatalf("unexpected filtered list: %+v", filtered)
	}
}
