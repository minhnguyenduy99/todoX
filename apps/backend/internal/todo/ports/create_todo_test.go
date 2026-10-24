package ports

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCreateTodoMissingTitle(t *testing.T) {
	router := newRouter()

	body := bytes.NewBufferString(`{"description":"cqrs","status":"NOT_STARTED"}`)
	req := httptest.NewRequest(http.MethodPost, "/todos", body)
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

func TestCreateTodo(t *testing.T) {
	router := newRouter()

	body := bytes.NewBufferString(`{"title":"Write docs","description":"cqrs","status":"NOT_STARTED"}`)
	req := httptest.NewRequest(http.MethodPost, "/todos", body)
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	created := decodeJSON[todoDataResponse](t, rec)
	if created.Data.Id == "" || created.Data.Title != "Write docs" || created.Data.Status != "NOT_STARTED" {
		t.Fatalf("unexpected create response: %+v", created.Data)
	}
}
