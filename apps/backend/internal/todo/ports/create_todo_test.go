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
	if len(created.Data.Tickets) != 0 {
		t.Fatalf("expected no tickets, got %+v", created.Data.Tickets)
	}
}

func TestCreateTodoWithTickets(t *testing.T) {
	router := newRouter()

	body := bytes.NewBufferString(`{
		"title":"Write docs",
		"description":"cqrs",
		"status":"NOT_STARTED",
		"tickets":[
			{"id":"PROJ-1234","source":"JIRA","title":"Login fails","type":"BUG","link":"https://your-domain.atlassian.net/browse/PROJ-1234"},
			{"id":"PROJ-1234","source":"JIRA","title":"Login fails","type":"BUG","link":"https://example.com/other-tracker/PROJ-1234"},
			{"id":"PROJ-1234","source":"LINEAR","title":"Login fails elsewhere","type":"BUG","link":"https://linear.app/acme/issue/PROJ-1234"},
			{"id":"GH-88","source":"GITHUB","title":"Add export","type":"FEATURE","link":"https://github.com/acme/app/issues/88"}
		]
	}`)
	req := httptest.NewRequest(http.MethodPost, "/todos", body)
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	created := decodeJSON[todoDataResponse](t, rec)
	if len(created.Data.Tickets) != 3 {
		t.Fatalf("expected deduped tickets, got %+v", created.Data.Tickets)
	}
	bug := ticketByLink(created.Data.Tickets, "https://example.com/other-tracker/PROJ-1234")
	if bug.Id != "PROJ-1234" || bug.Source != "JIRA" || bug.Title != "Login fails" || bug.Type != "BUG" {
		t.Fatalf("unexpected bug ticket: %+v", bug)
	}
	linear := ticketByLink(created.Data.Tickets, "https://linear.app/acme/issue/PROJ-1234")
	if linear.Id != "PROJ-1234" || linear.Source != "LINEAR" {
		t.Fatalf("same id from another source was collapsed: %+v", linear)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/todos/"+created.Data.Id, nil)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("get status %d body %s", getRec.Code, getRec.Body.String())
	}
	fetched := decodeJSON[todoDataResponse](t, getRec)
	if len(fetched.Data.Tickets) != 3 {
		t.Fatalf("stored tickets: %+v", fetched.Data.Tickets)
	}
}

func TestCreateTodoInvalidTicket(t *testing.T) {
	router := newRouter()

	body := bytes.NewBufferString(`{
		"title":"Write docs",
		"status":"NOT_STARTED",
		"tickets":[{"source":"JIRA","title":"Nope","type":"BUG","link":"https://example.com/not-a-ticket"}]
	}`)
	req := httptest.NewRequest(http.MethodPost, "/todos", body)
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	validationError := decodeJSON[validationErrorResponse](t, rec)
	if validationError.Error != "validation_failed" || validationError.Message != "id required" {
		t.Fatalf("unexpected validation error: %+v", validationError)
	}
}
