package ports

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestListTodos(t *testing.T) {
	router := newRouter()
	created := createTodo(t, router, "Write docs", "NOT_STARTED")
	createTodo(t, router, "Ship the fix", "IN_PROGRESS")

	listReq := httptest.NewRequest(http.MethodGet, "/todos", nil)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)
	if listRec.Code != http.StatusOK {
		t.Fatalf("list status %d body %s", listRec.Code, listRec.Body.String())
	}
	listed := decodeJSON[ListTodosResponse](t, listRec)
	if listed.TotalCount != len(listed.Items) || listed.TotalCount < 1 {
		t.Fatalf("unexpected list response: %+v", listed)
	}
	foundListed := false
	for _, item := range listed.Items {
		if item.Id == created.Id {
			foundListed = true
			if item.Title != "Write docs" {
				t.Fatalf("unexpected listed item: %+v", item)
			}
		}
	}
	if !foundListed {
		t.Fatalf("created todo missing from list: %+v", listed.Items)
	}

	filteredReq := httptest.NewRequest(http.MethodGet, "/todos?status=NOT_STARTED", nil)
	filteredRec := httptest.NewRecorder()
	router.ServeHTTP(filteredRec, filteredReq)
	if filteredRec.Code != http.StatusOK {
		t.Fatalf("filtered status %d body %s", filteredRec.Code, filteredRec.Body.String())
	}
	filtered := decodeJSON[ListTodosResponse](t, filteredRec)
	foundFiltered := false
	for _, item := range filtered.Items {
		if item.Status != "NOT_STARTED" {
			t.Fatalf("filter returned %s", item.Status)
		}
		if item.Id == created.Id {
			foundFiltered = true
		}
	}
	if !foundFiltered {
		t.Fatalf("created todo missing from filtered list: %+v", filtered.Items)
	}

	invalidReq := httptest.NewRequest(http.MethodGet, "/todos?status=ada", nil)
	invalidRec := httptest.NewRecorder()
	router.ServeHTTP(invalidRec, invalidReq)
	if invalidRec.Code != http.StatusBadRequest {
		t.Fatalf("invalid status %d body %s", invalidRec.Code, invalidRec.Body.String())
	}
	if invalidRec.Header().Get("Content-Type") != "application/json" {
		t.Fatalf("invalid status content-type %q body %s", invalidRec.Header().Get("Content-Type"), invalidRec.Body.String())
	}
}
