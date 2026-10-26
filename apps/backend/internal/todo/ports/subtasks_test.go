package ports

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCreateTodoWithSubtasks(t *testing.T) {
	router := newRouter()

	body := bytes.NewBufferString(`{
		"title":"Write docs",
		"description":"cqrs",
		"status":"NOT_STARTED",
		"subtasks":[
			{"title":"  Draft the outline  "},
			{"title":"Fill in examples","status":"IN_PROGRESS"},
			{"title":"Publish","status":"COMPLETED"}
		]
	}`)
	req := httptest.NewRequest(http.MethodPost, "/todos", body)
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("create status %d body %s", rec.Code, rec.Body.String())
	}
	created := decodeJSON[todoDataResponse](t, rec)
	if len(created.Data.Subtasks) != 3 {
		t.Fatalf("unexpected subtasks: %+v", created.Data.Subtasks)
	}
	draft := created.Data.Subtasks[0]
	if draft.Id == "" || draft.Title != "Draft the outline" || draft.Status != "NOT_STARTED" {
		t.Fatalf("unexpected first subtask: %+v", draft)
	}
	if created.Data.Subtasks[1].Title != "Fill in examples" || created.Data.Subtasks[1].Status != "IN_PROGRESS" {
		t.Fatalf("unexpected second subtask: %+v", created.Data.Subtasks[1])
	}
	if created.Data.Subtasks[2].Title != "Publish" || created.Data.Subtasks[2].Status != "COMPLETED" {
		t.Fatalf("unexpected third subtask: %+v", created.Data.Subtasks[2])
	}
	if draft.Id == created.Data.Subtasks[1].Id || draft.Id == created.Data.Subtasks[2].Id {
		t.Fatalf("subtask ids are not unique: %+v", created.Data.Subtasks)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/todos/"+created.Data.Id, nil)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	fetched := decodeJSON[todoDataResponse](t, getRec)
	if len(fetched.Data.Subtasks) != 3 || fetched.Data.Subtasks[0].Id != draft.Id {
		t.Fatalf("stored subtasks: %+v", fetched.Data.Subtasks)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/todos", nil)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)
	listed := decodeJSON[ListTodosResponse](t, listRec)
	var found *TodoItemResponse
	for i := range listed.Items {
		if listed.Items[i].Id == created.Data.Id {
			found = &listed.Items[i]
			break
		}
	}
	if found == nil || len(found.Subtasks) != 3 || found.Subtasks[1].Status != "IN_PROGRESS" {
		t.Fatalf("listed subtasks: %+v", listed.Items)
	}
}

func TestCreateTodoAssignsSubtaskId(t *testing.T) {
	router := newRouter()

	body := bytes.NewBufferString(`{
		"title":"Subtask id on create",
		"status":"NOT_STARTED",
		"subtasks":[{"id":"11111111-1111-1111-1111-111111111111","title":"Ghost"}]
	}`)
	req := httptest.NewRequest(http.MethodPost, "/todos", body)
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	created := decodeJSON[todoDataResponse](t, rec)
	if len(created.Data.Subtasks) != 1 || created.Data.Subtasks[0].Title != "Ghost" || created.Data.Subtasks[0].Id == "" || created.Data.Subtasks[0].Id == "11111111-1111-1111-1111-111111111111" {
		t.Fatalf("create did not assign a subtask id: %+v", created.Data.Subtasks)
	}
}

func TestCreateTodoRejectsInvalidSubtaskStatus(t *testing.T) {
	router := newRouter()

	body := bytes.NewBufferString(`{"title":"Bad status","status":"NOT_STARTED","subtasks":[{"title":"Nope","status":"FAILED"}]}`)
	req := httptest.NewRequest(http.MethodPost, "/todos", body)
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	validationError := decodeJSON[validationErrorResponse](t, rec)
	if validationError.Error != "validation_failed" || validationError.Message != "status oneof: NOT_STARTED IN_PROGRESS COMPLETED" {
		t.Fatalf("unexpected validation error: %+v", validationError)
	}
}

func TestUpdateTodoSubtasks(t *testing.T) {
	router := newRouter()
	created := createTodoWithSubtasks(t, router)
	first := created.Subtasks[0]
	second := created.Subtasks[1]

	keepBody := bytes.NewBufferString(`{"title":"Write the docs","description":"cqrs","changelog":"renamed"}`)
	keepRec := patchTodo(t, router, created.Id, keepBody)
	kept := decodeJSON[todoDataResponse](t, keepRec)
	if len(kept.Data.Subtasks) != 2 || kept.Data.Subtasks[0].Id != first.Id || kept.Data.Subtasks[1].Title != "Fill in examples" {
		t.Fatalf("omitted subtasks were changed: %+v", kept.Data.Subtasks)
	}

	emptyBody := bytes.NewBufferString(`{"title":"Write the docs","subtasks":[]}`)
	emptyRec := patchTodo(t, router, created.Id, emptyBody)
	emptied := decodeJSON[todoDataResponse](t, emptyRec)
	if len(emptied.Data.Subtasks) != 2 {
		t.Fatalf("empty subtasks cleared the list: %+v", emptied.Data.Subtasks)
	}

	updateBody := bytes.NewBufferString(fmt.Sprintf(`{
		"title":"Write the docs",
		"subtasks":[
			{"id":"%s","title":"Draft the outline again"},
			{"title":"Review","status":"COMPLETED"}
		]
	}`, first.Id))
	updateRec := patchTodo(t, router, created.Id, updateBody)
	updated := decodeJSON[todoDataResponse](t, updateRec)
	if len(updated.Data.Subtasks) != 3 {
		t.Fatalf("unexpected subtasks: %+v", updated.Data.Subtasks)
	}
	if updated.Data.Subtasks[0].Id != first.Id || updated.Data.Subtasks[0].Title != "Draft the outline again" || updated.Data.Subtasks[0].Status != "NOT_STARTED" {
		t.Fatalf("status was not kept: %+v", updated.Data.Subtasks[0])
	}
	if updated.Data.Subtasks[1].Id != second.Id || updated.Data.Subtasks[1].Status != "IN_PROGRESS" {
		t.Fatalf("untouched subtask changed: %+v", updated.Data.Subtasks[1])
	}
	if updated.Data.Subtasks[2].Title != "Review" || updated.Data.Subtasks[2].Status != "COMPLETED" || updated.Data.Subtasks[2].Id == "" {
		t.Fatalf("new subtask: %+v", updated.Data.Subtasks[2])
	}

	statusBody := bytes.NewBufferString(fmt.Sprintf(`{
		"title":"Write the docs",
		"subtasks":[{"id":"%s","title":"Draft the outline again","status":"IN_PROGRESS"}]
	}`, first.Id))
	statusRec := patchTodo(t, router, created.Id, statusBody)
	withStatus := decodeJSON[todoDataResponse](t, statusRec)
	if withStatus.Data.Subtasks[0].Status != "IN_PROGRESS" || len(withStatus.Data.Subtasks) != 3 {
		t.Fatalf("status update: %+v", withStatus.Data.Subtasks)
	}

	missingID := "22222222-2222-2222-2222-222222222222"
	missingBody := bytes.NewBufferString(fmt.Sprintf(`{
		"title":"Should stay",
		"subtasks":[
			{"id":"%s","title":"Draft the outline again","status":"COMPLETED"},
			{"id":"%s","title":"Missing"}
		]
	}`, first.Id, missingID))
	missingReq := httptest.NewRequest(http.MethodPatch, "/todos/"+created.Id, missingBody)
	missingReq.Header.Set("content-type", "application/json")
	missingRec := httptest.NewRecorder()
	router.ServeHTTP(missingRec, missingReq)
	if missingRec.Code != http.StatusBadRequest {
		t.Fatalf("status %d body %s", missingRec.Code, missingRec.Body.String())
	}
	apiError := decodeJSON[apiErrorResponse](t, missingRec)
	if apiError.Error.Code != "SUBTASK_NOT_FOUND" || len(apiError.Error.MissingIds) != 1 || apiError.Error.MissingIds[0] != missingID {
		t.Fatalf("unexpected error: %+v", apiError.Error)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/todos/"+created.Id, nil)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	fetched := decodeJSON[todoDataResponse](t, getRec)
	if fetched.Data.Title != "Write the docs" || len(fetched.Data.Subtasks) != 3 || fetched.Data.Subtasks[0].Status != "IN_PROGRESS" {
		t.Fatalf("failed update changed the todo: %+v", fetched.Data)
	}
}

func TestRemoveSubtasks(t *testing.T) {
	router := newRouter()
	created := createTodoWithSubtasks(t, router)
	first := created.Subtasks[0]
	second := created.Subtasks[1]

	body := bytes.NewBufferString(fmt.Sprintf(`{"subtasks":[{"id":"%s"}]}`, first.Id))
	req := httptest.NewRequest(http.MethodPost, "/todos/"+created.Id+"/removeSubtasks", body)
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	removed := decodeJSON[todoDataResponse](t, rec)
	if len(removed.Data.Subtasks) != 1 || removed.Data.Subtasks[0].Id != second.Id {
		t.Fatalf("unexpected remove response: %+v", removed.Data.Subtasks)
	}
	if len(removed.Data.Tickets) != 1 || removed.Data.Tickets[0].Id != "GH-1" {
		t.Fatalf("remove changed tickets: %+v", removed.Data.Tickets)
	}

	missingID := "33333333-3333-3333-3333-333333333333"
	otherMissingID := "44444444-4444-4444-4444-444444444444"
	mixed := bytes.NewBufferString(fmt.Sprintf(`{"subtasks":[{"id":"%s"},{"id":"%s"},{"id":"%s"}]}`, second.Id, missingID, otherMissingID))
	mixedReq := httptest.NewRequest(http.MethodPost, "/todos/"+created.Id+"/removeSubtasks", mixed)
	mixedReq.Header.Set("content-type", "application/json")
	mixedRec := httptest.NewRecorder()
	router.ServeHTTP(mixedRec, mixedReq)
	if mixedRec.Code != http.StatusBadRequest {
		t.Fatalf("status %d body %s", mixedRec.Code, mixedRec.Body.String())
	}
	apiError := decodeJSON[apiErrorResponse](t, mixedRec)
	if apiError.Error.Code != "SUBTASK_NOT_FOUND" || len(apiError.Error.MissingIds) != 2 || apiError.Error.MissingIds[0] != missingID || apiError.Error.MissingIds[1] != otherMissingID {
		t.Fatalf("unexpected error: %+v", apiError.Error)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/todos/"+created.Id, nil)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	fetched := decodeJSON[todoDataResponse](t, getRec)
	if len(fetched.Data.Subtasks) != 1 || fetched.Data.Subtasks[0].Id != second.Id {
		t.Fatalf("partial remove changed subtasks: %+v", fetched.Data.Subtasks)
	}

	missingTodo := bytes.NewBufferString(fmt.Sprintf(`{"subtasks":[{"id":"%s"}]}`, second.Id))
	missingReq := httptest.NewRequest(http.MethodPost, "/todos/missing/removeSubtasks", missingTodo)
	missingReq.Header.Set("content-type", "application/json")
	missingRec := httptest.NewRecorder()
	router.ServeHTTP(missingRec, missingReq)
	if missingRec.Code != http.StatusNotFound {
		t.Fatalf("status %d body %s", missingRec.Code, missingRec.Body.String())
	}
	notFound := decodeJSON[apiErrorResponse](t, missingRec)
	if notFound.Error.Code != "TODO_NOT_FOUND" {
		t.Fatalf("unexpected error: %+v", notFound.Error)
	}
}

func TestRemoveSubtasksRejectsEmptyId(t *testing.T) {
	router := newRouter()
	created := createTodoWithSubtasks(t, router)

	for _, body := range []string{
		`{"subtasks":[{"id":""}]}`,
		`{"subtasks":[{}]}`,
	} {
		req := httptest.NewRequest(http.MethodPost, "/todos/"+created.Id+"/removeSubtasks", bytes.NewBufferString(body))
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

	getReq := httptest.NewRequest(http.MethodGet, "/todos/"+created.Id, nil)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	fetched := decodeJSON[todoDataResponse](t, getRec)
	if len(fetched.Data.Subtasks) != 2 {
		t.Fatalf("invalid request changed subtasks: %+v", fetched.Data.Subtasks)
	}
}

func TestDeleteTicketsKeepsSubtasks(t *testing.T) {
	router := newRouter()
	created := createTodoWithSubtasks(t, router)

	body := bytes.NewBufferString(`{"tickets":[{"source":"JIRA","id":"GH-1"}]}`)
	req := httptest.NewRequest(http.MethodPost, "/todos/"+created.Id+"/deleteTickets", body)
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	deleted := decodeJSON[todoDataResponse](t, rec)
	if len(deleted.Data.Tickets) != 0 || len(deleted.Data.Subtasks) != 2 {
		t.Fatalf("unexpected delete response: %+v", deleted.Data)
	}
}

func createTodoWithSubtasks(t *testing.T, router http.Handler) TodoItemResponse {
	t.Helper()
	body := bytes.NewBufferString(`{
		"title":"Write docs",
		"description":"cqrs",
		"status":"NOT_STARTED",
		"tickets":[
			{"id":"GH-1","source":"JIRA","title":"Login fails","type":"BUG","link":"https://example.com/GH-1"}
		],
		"subtasks":[
			{"title":"Draft the outline"},
			{"title":"Fill in examples","status":"IN_PROGRESS"}
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

func patchTodo(t *testing.T, router http.Handler, id string, body *bytes.Buffer) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPatch, "/todos/"+id, body)
	req.Header.Set("content-type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("patch status %d body %s", rec.Code, rec.Body.String())
	}
	return rec
}
