package ports

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDeleteTickets(t *testing.T) {
	router := newRouter()
	created := createTodoWithTickets(t, router)

	body := bytes.NewBufferString(`{"tickets":[{"source":"JIRA","id":"PROJ-1234"}]}`)
	req := httptest.NewRequest(http.MethodPost, "/todos/"+created.Id+"/deleteTickets", body)
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	deleted := decodeJSON[todoDataResponse](t, rec)
	if deleted.Data.Id != created.Id || len(deleted.Data.Tickets) != 1 {
		t.Fatalf("unexpected delete response: %+v", deleted.Data)
	}
	kept := deleted.Data.Tickets[0]
	if kept.Id != "GH-88" || kept.Source != "GITHUB" || kept.Title != "Add export" {
		t.Fatalf("remaining ticket: %+v", kept)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/todos/"+created.Id, nil)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	fetched := decodeJSON[todoDataResponse](t, getRec)
	if len(fetched.Data.Tickets) != 1 || fetched.Data.Tickets[0].Id != "GH-88" {
		t.Fatalf("stored tickets: %+v", fetched.Data.Tickets)
	}
}

func TestDeleteTicketsRemovesEveryMatch(t *testing.T) {
	router := newRouter()
	created := createTodoWithTickets(t, router)

	body := bytes.NewBufferString(`{"tickets":[{"source":"JIRA","id":"PROJ-1234"},{"source":"GITHUB","id":"GH-88"}]}`)
	req := httptest.NewRequest(http.MethodPost, "/todos/"+created.Id+"/deleteTickets", body)
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	deleted := decodeJSON[todoDataResponse](t, rec)
	if len(deleted.Data.Tickets) != 0 {
		t.Fatalf("expected no tickets: %+v", deleted.Data.Tickets)
	}
}

func TestDeleteTicketsIgnoresUnknownTicket(t *testing.T) {
	router := newRouter()
	created := createTodoWithTickets(t, router)

	body := bytes.NewBufferString(`{"tickets":[{"source":"JIRA","id":"MISSING"}]}`)
	req := httptest.NewRequest(http.MethodPost, "/todos/"+created.Id+"/deleteTickets", body)
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	deleted := decodeJSON[todoDataResponse](t, rec)
	if len(deleted.Data.Tickets) != 2 {
		t.Fatalf("unknown ticket changed the set: %+v", deleted.Data.Tickets)
	}
}

func TestDeleteTicketsNotFound(t *testing.T) {
	router := newRouter()

	body := bytes.NewBufferString(`{"tickets":[{"source":"JIRA","id":"PROJ-1234"}]}`)
	req := httptest.NewRequest(http.MethodPost, "/todos/missing/deleteTickets", body)
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

func TestDeleteTicketsRequiresSourceAndId(t *testing.T) {
	router := newRouter()
	created := createTodoWithTickets(t, router)

	body := bytes.NewBufferString(`{"tickets":[{"id":"PROJ-1234"}]}`)
	req := httptest.NewRequest(http.MethodPost, "/todos/"+created.Id+"/deleteTickets", body)
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	validationError := decodeJSON[validationErrorResponse](t, rec)
	if validationError.Error != "validation_failed" || validationError.Message != "source required" {
		t.Fatalf("unexpected validation error: %+v", validationError)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/todos/"+created.Id, nil)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	fetched := decodeJSON[todoDataResponse](t, getRec)
	if len(fetched.Data.Tickets) != 2 {
		t.Fatalf("invalid request changed tickets: %+v", fetched.Data.Tickets)
	}
}

func TestDeleteTicketsRejectsBlankSource(t *testing.T) {
	router := newRouter()
	created := createTodoWithTickets(t, router)

	body := bytes.NewBufferString(`{"tickets":[{"source":" ","id":"PROJ-1234"}]}`)
	req := httptest.NewRequest(http.MethodPost, "/todos/"+created.Id+"/deleteTickets", body)
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	apiError := decodeJSON[apiErrorResponse](t, rec)
	if apiError.Error.Code != "INVALID_TICKET_ID_FORMAT" {
		t.Fatalf("unexpected error: %+v", apiError.Error)
	}
}

func createTodoWithTickets(t *testing.T, router http.Handler) TodoItemResponse {
	t.Helper()
	body := bytes.NewBufferString(`{
		"title":"Write docs",
		"description":"cqrs",
		"status":"NOT_STARTED",
		"tickets":[
			{"id":"PROJ-1234","source":"JIRA","title":"Login fails","type":"BUG","link":"https://your-domain.atlassian.net/browse/PROJ-1234"},
			{"id":"GH-88","source":"GITHUB","title":"Add export","type":"FEATURE","link":"https://github.com/acme/app/issues/88"}
		]
	}`)
	req := httptest.NewRequest(http.MethodPost, "/todos", body)
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("create status %d body %s", rec.Code, rec.Body.String())
	}
	return decodeJSON[todoDataResponse](t, rec).Data
}
