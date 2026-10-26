package domains

import (
	"errors"
	"testing"
)

func TestUpdateInfoAddsSubtaskWhenIdIsMissing(t *testing.T) {
	status := SubtaskStatusInProgress
	todo := &Todo{
		Title: "Write docs",
		Subtasks: []Subtask{{
			Id:     "existing",
			Title:  "Draft",
			Status: SubtaskStatusNotStarted,
		}},
	}

	err := todo.UpdateInfo(UpdatedTodoInfo{
		Title: "Write the docs",
		Subtasks: []NewSubtask{{
			Title:  "Review",
			Status: &status,
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(todo.Subtasks) != 2 {
		t.Fatalf("expected a new subtask, got %+v", todo.Subtasks)
	}
	if todo.Subtasks[0].Id != "existing" || todo.Subtasks[0].Title != "Draft" || todo.Subtasks[0].Status != SubtaskStatusNotStarted {
		t.Fatalf("existing subtask changed: %+v", todo.Subtasks[0])
	}
	added := todo.Subtasks[1]
	if added.Id == "" || added.Title != "Review" || added.Status != SubtaskStatusInProgress {
		t.Fatalf("new subtask: %+v", added)
	}
}

func TestUpdateInfoUpdatesSubtaskWhenIdExists(t *testing.T) {
	status := SubtaskStatusCompleted
	todo := &Todo{
		Title: "Write docs",
		Subtasks: []Subtask{{
			Id:     "subtask-1",
			Title:  "Draft",
			Status: SubtaskStatusNotStarted,
		}},
	}

	err := todo.UpdateInfo(UpdatedTodoInfo{
		Title: "Write the docs",
		Subtasks: []NewSubtask{{
			Id:     "subtask-1",
			Title:  "Draft the outline",
			Status: &status,
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(todo.Subtasks) != 1 {
		t.Fatalf("update changed the subtask count: %+v", todo.Subtasks)
	}
	updated := todo.Subtasks[0]
	if updated.Id != "subtask-1" || updated.Title != "Draft the outline" || updated.Status != SubtaskStatusCompleted {
		t.Fatalf("subtask was not updated: %+v", updated)
	}
}

func TestUpdateInfoReturnsSubtaskNotFoundWhenIdDoesNotMatch(t *testing.T) {
	status := SubtaskStatusCompleted
	todo := &Todo{
		Title: "Write docs",
		Subtasks: []Subtask{{
			Id:     "subtask-1",
			Title:  "Draft",
			Status: SubtaskStatusNotStarted,
		}},
	}

	err := todo.UpdateInfo(UpdatedTodoInfo{
		Title: "Changed",
		Subtasks: []NewSubtask{{
			Id:     "missing",
			Title:  "Nope",
			Status: &status,
		}},
	})
	var notFound SubtaskNotFoundError
	if !errors.As(err, &notFound) {
		t.Fatalf("expected SubtaskNotFoundError, got %v", err)
	}
	if len(notFound.MissingIds) != 1 || notFound.MissingIds[0] != "missing" {
		t.Fatalf("missing ids: %+v", notFound.MissingIds)
	}
	if todo.Title != "Write docs" || len(todo.Subtasks) != 1 || todo.Subtasks[0].Title != "Draft" || todo.Subtasks[0].Status != SubtaskStatusNotStarted {
		t.Fatalf("failed update changed the todo: %+v", todo)
	}
}
