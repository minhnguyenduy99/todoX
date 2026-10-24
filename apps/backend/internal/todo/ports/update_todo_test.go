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

func TestUpdateTodoTickets(t *testing.T) {
	router := newRouter()

	createBody := bytes.NewBufferString(`{
		"title":"Write docs",
		"description":"cqrs",
		"status":"NOT_STARTED",
		"tickets":[
			{"id":"PROJ-1234","source":"JIRA","title":"Login fails","type":"BUG","link":"https://your-domain.atlassian.net/browse/PROJ-1234"}
		]
	}`)
	createReq := httptest.NewRequest(http.MethodPost, "/todos", createBody)
	createReq.Header.Set("content-type", "application/json")
	createRec := httptest.NewRecorder()
	router.ServeHTTP(createRec, createReq)
	if createRec.Code != http.StatusOK {
		t.Fatalf("create status %d body %s", createRec.Code, createRec.Body.String())
	}
	created := decodeJSON[todoDataResponse](t, createRec)

	keepBody := bytes.NewBufferString(`{"title":"Write the docs","description":"cqrs","changelog":"renamed"}`)
	keepReq := httptest.NewRequest(http.MethodPatch, "/todos/"+created.Data.Id, keepBody)
	keepReq.Header.Set("content-type", "application/json")
	keepRec := httptest.NewRecorder()
	router.ServeHTTP(keepRec, keepReq)
	if keepRec.Code != http.StatusOK {
		t.Fatalf("keep status %d body %s", keepRec.Code, keepRec.Body.String())
	}
	kept := decodeJSON[todoDataResponse](t, keepRec)
	if len(kept.Data.Tickets) != 1 || kept.Data.Tickets[0].Title != "Login fails" {
		t.Fatalf("omitted tickets were changed: %+v", kept.Data.Tickets)
	}

	replaceBody := bytes.NewBufferString(`{
		"title":"Write the docs",
		"description":"cqrs",
		"changelog":"renamed",
		"tickets":[
			{"id":"PROJ-1234","source":"JIRA","title":"Login timeout","type":"BUG","link":"https://linear.app/acme/issue/PROJ-1234"},
			{"id":"GH-88","source":"GITHUB","title":"Add export","type":"FEATURE","link":"https://github.com/acme/app/issues/88"}
		]
	}`)
	replaceReq := httptest.NewRequest(http.MethodPatch, "/todos/"+created.Data.Id, replaceBody)
	replaceReq.Header.Set("content-type", "application/json")
	replaceRec := httptest.NewRecorder()
	router.ServeHTTP(replaceRec, replaceReq)
	if replaceRec.Code != http.StatusOK {
		t.Fatalf("replace status %d body %s", replaceRec.Code, replaceRec.Body.String())
	}
	replaced := decodeJSON[todoDataResponse](t, replaceRec)
	if len(replaced.Data.Tickets) != 2 {
		t.Fatalf("unexpected tickets: %+v", replaced.Data.Tickets)
	}
	updatedBug := ticketByLink(replaced.Data.Tickets, "https://linear.app/acme/issue/PROJ-1234")
	if updatedBug.Id != "PROJ-1234" || updatedBug.Source != "JIRA" || updatedBug.Title != "Login timeout" || updatedBug.Type != "BUG" {
		t.Fatalf("ticket was not updated: %+v", updatedBug)
	}

	againBody := bytes.NewBufferString(`{
		"title":"Write the docs",
		"tickets":[
			{"id":"PROJ-1234","source":"JIRA","title":"Login timeout again","type":"BUG","link":"https://linear.app/acme/issue/PROJ-1234"}
		]
	}`)
	againReq := httptest.NewRequest(http.MethodPatch, "/todos/"+created.Data.Id, againBody)
	againReq.Header.Set("content-type", "application/json")
	againRec := httptest.NewRecorder()
	router.ServeHTTP(againRec, againReq)
	if againRec.Code != http.StatusOK {
		t.Fatalf("upsert status %d body %s", againRec.Code, againRec.Body.String())
	}
	upserted := decodeJSON[todoDataResponse](t, againRec)
	if len(upserted.Data.Tickets) != 2 {
		t.Fatalf("upsert removed a ticket: %+v", upserted.Data.Tickets)
	}
	jira := ticketByLink(upserted.Data.Tickets, "https://linear.app/acme/issue/PROJ-1234")
	if jira.Title != "Login timeout again" {
		t.Fatalf("jira ticket was not updated: %+v", jira)
	}
	github := ticketByLink(upserted.Data.Tickets, "https://github.com/acme/app/issues/88")
	if github.Id != "GH-88" || github.Source != "GITHUB" {
		t.Fatalf("github ticket was not kept: %+v", github)
	}
}

func TestUpdateTodoInvalidTicket(t *testing.T) {
	router := newRouter()
	created := createTodo(t, router, "Write docs", "NOT_STARTED")

	body := bytes.NewBufferString(`{
		"title":"Should stay",
		"tickets":[{"source":"JIRA","title":"Nope","type":"FEATURE","link":"https://example.com/not-a-ticket"}]
	}`)
	req := httptest.NewRequest(http.MethodPatch, "/todos/"+created.Id, body)
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

	getReq := httptest.NewRequest(http.MethodGet, "/todos/"+created.Id, nil)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	fetched := decodeJSON[todoDataResponse](t, getRec)
	if fetched.Data.Title != "Write docs" {
		t.Fatalf("invalid ticket update changed the todo: %+v", fetched.Data)
	}
}
