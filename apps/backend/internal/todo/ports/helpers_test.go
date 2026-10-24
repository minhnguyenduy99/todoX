package ports

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"todox-backend/internal/todo/adapters"

	"github.com/go-chi/chi/v5"
)

type todoDataResponse struct {
	Data TodoItemResponse `json:"data"`
}

type apiErrorResponse struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

type validationErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

func newRouter() chi.Router {
	router := chi.NewRouter()
	repo := &adapters.InMemRepository{}
	Register(router, repo, repo)
	return router
}

func createTodo(t *testing.T, router http.Handler, title, status string) TodoItemResponse {
	t.Helper()
	body := bytes.NewBufferString(`{"title":"` + title + `","description":"cqrs","status":"` + status + `"}`)
	req := httptest.NewRequest(http.MethodPost, "/todos", body)
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("create status %d body %s", rec.Code, rec.Body.String())
	}
	var created todoDataResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	return created.Data
}

func ticketByLink(tickets []TicketResponse, link string) TicketResponse {
	for _, ticket := range tickets {
		if ticket.Link == link {
			return ticket
		}
	}
	return TicketResponse{}
}

func decodeJSON[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var body T
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	return body
}
