package ports

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGetTodoById(t *testing.T) {
	router := newRouter()
	created := createTodo(t, router, "Write docs", "NOT_STARTED")

	getReq := httptest.NewRequest(http.MethodGet, "/todos/"+created.Id, nil)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)

	if getRec.Code != http.StatusOK {
		t.Fatalf("get status %d body %s", getRec.Code, getRec.Body.String())
	}
	fetched := decodeJSON[todoDataResponse](t, getRec)
	if fetched.Data.Id != created.Id || fetched.Data.Title != "Write docs" || fetched.Data.Status != "NOT_STARTED" {
		t.Fatalf("unexpected get response: %+v", fetched.Data)
	}

	missingReq := httptest.NewRequest(http.MethodGet, "/todos/missing", nil)
	missingRec := httptest.NewRecorder()
	router.ServeHTTP(missingRec, missingReq)
	if missingRec.Code != http.StatusNotFound {
		t.Fatalf("missing status %d body %s", missingRec.Code, missingRec.Body.String())
	}
}
