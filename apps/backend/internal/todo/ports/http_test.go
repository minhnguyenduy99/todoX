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

func TestCreateTodoCommand(t *testing.T) {
	router := chi.NewRouter()
	repo := &adapters.InMemRepository{}
	Register(router, repo, repo)

	body := bytes.NewBufferString(`{"title":"Write docs","description":"cqrs","status":"NOT_STARTED"}`)
	req := httptest.NewRequest(http.MethodPost, "/todos", body)
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}

	var created struct {
		Data TodoItemResponse `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.Data.Id == "" || created.Data.Title != "Write docs" || created.Data.Status != "NOT_STARTED" {
		t.Fatalf("unexpected create response: %+v", created.Data)
	}

	patchBody := bytes.NewBufferString(`{"title":"Write the docs","description":"cqrs","changelog":"renamed the task"}`)
	patchReq := httptest.NewRequest(http.MethodPatch, "/todos/"+created.Data.Id, patchBody)
	patchReq.Header.Set("content-type", "application/json")
	patchRec := httptest.NewRecorder()
	router.ServeHTTP(patchRec, patchReq)

	if patchRec.Code != http.StatusOK {
		t.Fatalf("patch status %d body %s", patchRec.Code, patchRec.Body.String())
	}
	var updated struct {
		Data TodoItemResponse `json:"data"`
	}
	if err := json.Unmarshal(patchRec.Body.Bytes(), &updated); err != nil {
		t.Fatal(err)
	}
	if updated.Data.Id != created.Data.Id || updated.Data.Title != "Write the docs" || updated.Data.Changelog != "renamed the task" {
		t.Fatalf("unexpected patch response: %+v", updated.Data)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/todos/"+created.Data.Id, nil)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)

	if getRec.Code != http.StatusOK {
		t.Fatalf("get status %d body %s", getRec.Code, getRec.Body.String())
	}
	var fetched struct {
		Data TodoItemResponse `json:"data"`
	}
	if err := json.Unmarshal(getRec.Body.Bytes(), &fetched); err != nil {
		t.Fatal(err)
	}
	if fetched.Data.Id != created.Data.Id || fetched.Data.Title != "Write the docs" || fetched.Data.Status != "NOT_STARTED" {
		t.Fatalf("unexpected get response: %+v", fetched.Data)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/todos", nil)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)
	if listRec.Code != http.StatusOK {
		t.Fatalf("list status %d body %s", listRec.Code, listRec.Body.String())
	}
	var listed ListTodosResponse
	if err := json.Unmarshal(listRec.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	if listed.TotalCount != len(listed.Items) || listed.TotalCount < 1 {
		t.Fatalf("unexpected list response: %+v", listed)
	}
	foundListed := false
	for _, item := range listed.Items {
		if item.Id == created.Data.Id {
			foundListed = true
			if item.Title != "Write the docs" {
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
	var filtered ListTodosResponse
	if err := json.Unmarshal(filteredRec.Body.Bytes(), &filtered); err != nil {
		t.Fatal(err)
	}
	for _, item := range filtered.Items {
		if item.Status != "NOT_STARTED" {
			t.Fatalf("filter returned %s", item.Status)
		}
	}

	invalidReq := httptest.NewRequest(http.MethodGet, "/todos?status=ada", nil)
	invalidRec := httptest.NewRecorder()
	router.ServeHTTP(invalidRec, invalidReq)
	if invalidRec.Header().Get("Content-Type") != "application/json" {
		t.Fatalf("invalid status content-type %q body %s", invalidRec.Header().Get("Content-Type"), invalidRec.Body.String())
	}

	missingReq := httptest.NewRequest(http.MethodGet, "/todos/missing", nil)
	missingRec := httptest.NewRecorder()
	router.ServeHTTP(missingRec, missingReq)
	if missingRec.Code != http.StatusNotFound {
		t.Fatalf("missing status %d body %s", missingRec.Code, missingRec.Body.String())
	}
}
