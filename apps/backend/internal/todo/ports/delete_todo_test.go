package ports

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDeleteTodoNotFound(t *testing.T) {
	router := newRouter()

	req := httptest.NewRequest(http.MethodDelete, "/todos/missing", nil)
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

func TestDeleteTodo(t *testing.T) {
	router := newRouter()
	created := createTodo(t, router, "Write docs", "NOT_STARTED")

	req := httptest.NewRequest(http.MethodDelete, "/todos/"+created.Id, nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	if rec.Body.Len() != 0 {
		t.Fatalf("delete body %s", rec.Body.String())
	}

	getReq := httptest.NewRequest(http.MethodGet, "/todos/"+created.Id, nil)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusNotFound {
		t.Fatalf("get deleted status %d body %s", getRec.Code, getRec.Body.String())
	}
}
