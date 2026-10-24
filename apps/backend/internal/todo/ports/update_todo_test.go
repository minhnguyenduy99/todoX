package ports

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestUpdateTodoInfoNotFound(t *testing.T) {
	router := newRouter()

	body := bytes.NewBufferString(`{"title":"Write the docs","description":"cqrs","changelog":"renamed the task"}`)
	req := httptest.NewRequest(http.MethodPatch, "/todos/missing", body)
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	apiError := decodeJSON[apiErrorResponse](t, rec)
	if apiError.Error.Code != "TODO_NOT_FOUND" {
		t.Fatalf("unexpected error: %+v", apiError.Error)
	}
}

func TestUpdateTodoInfoMissingTitle(t *testing.T) {
	router := newRouter()
	created := createTodo(t, router, "Write docs", "NOT_STARTED")

	body := bytes.NewBufferString(`{"description":"cqrs","changelog":"renamed the task"}`)
	req := httptest.NewRequest(http.MethodPatch, "/todos/"+created.Id, body)
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	validationError := decodeJSON[validationErrorResponse](t, rec)
	if validationError.Error != "validation_failed" || validationError.Message != "title required" {
		t.Fatalf("unexpected validation error: %+v", validationError)
	}
}

func TestUpdateTodoInfo(t *testing.T) {
	router := newRouter()
	created := createTodo(t, router, "Write docs", "NOT_STARTED")

	body := bytes.NewBufferString(`{"title":"Write the docs","description":"cqrs","changelog":"renamed the task"}`)
	req := httptest.NewRequest(http.MethodPatch, "/todos/"+created.Id, body)
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	updated := decodeJSON[todoDataResponse](t, rec)
	if updated.Data.Id != created.Id || updated.Data.Title != "Write the docs" || updated.Data.Changelog != "renamed the task" {
		t.Fatalf("unexpected patch response: %+v", updated.Data)
	}
}
