package ports

import (
	"encoding/json"
	"errors"
	"net/http"

	"todox-backend/internal/infras"
	"todox-backend/internal/shared"
	"todox-backend/internal/todo/adapters"
	"todox-backend/internal/todo/commands"
	"todox-backend/internal/todo/domains"
	"todox-backend/internal/todo/interfaces"
	"todox-backend/internal/todo/queries"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TodoItemResponse struct {
	Id          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Changelog   string `json:"changelog"`
	Status      string `json:"status"`
	CreatedDate int64  `json:"created_date"`
	UpdatedDate int64  `json:"updated_date"`
}

type CreateTodoDto struct {
	Title       string             `json:"title" validate:"required,min=1,max=200"`
	Description string             `json:"description" validate:"max=2000"`
	Changelog   string             `json:"changelog" validate:"max=2000"`
	Status      domains.TodoStatus `json:"status" validate:"required,oneof=NOT_STARTED IN_PROGRESS TESTING WAIT_FOR_STAGING COMPLETED"`
}

type UpdateTodoInfoDto struct {
	Title       string `json:"title,omitempty" validate:"omitempty,max=255"`
	Description string `json:"description,omitempty" validate:"omitempty,max=2000"`
	Changelog   string `json:"changelog,omitempty" validate:"omitempty,max=2000"`
}

type UpdateTodoInfoResponse struct {
	Id          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Changelog   string `json:"changelog"`
	UpdatedDate int64  `json:"updated_date"`
}

type ListTodosResponse struct {
	TotalCount int                `json:"total_count"`
	Items      []TodoItemResponse `json:"items"`
}

type ListTodosFilterQuery struct {
	Status string `json:"status" form:"status" validate:"omitempty,oneof=NOT_STARTED IN_PROGRESS TESTING WAIT_FOR_STAGING COMPLETED"`
}

func Setup(r chi.Router, pool *pgxpool.Pool) {
	repo := &adapters.PostgresTodoRepository{Pool: pool}
	Register(r, repo, repo)
}

func Register(r chi.Router, todoRepo interfaces.ITodoRepository, todoReadModel interfaces.ITodoReadModel) {
	createTodo := &commands.CreateTodoHandler{Repo: todoRepo}
	updateTodoInfo := &commands.UpdateTodoInfoHandler{Repo: todoRepo}
	getTodoById := &queries.GetTodoByIdHandler{ReadModel: todoReadModel}
	listTodos := &queries.ListTodosHandler{ReadModel: todoReadModel}

	r.With(infras.ValidateMiddleware[ListTodosFilterQuery]("QUERY")).Get(
		"/todos",
		func(w http.ResponseWriter, r *http.Request) { handleListTodos(w, r, listTodos) },
	)
	r.With(infras.ValidateMiddleware[CreateTodoDto]("BODY")).Post(
		"/todos",
		func(w http.ResponseWriter, r *http.Request) { handleCreateTodo(w, r, createTodo) },
	)
	r.Get(
		"/todos/{id}",
		func(w http.ResponseWriter, r *http.Request) { handleGetTodoById(w, r, getTodoById) },
	)
	r.With(infras.ValidateMiddleware[UpdateTodoInfoDto]("BODY")).Patch(
		"/todos/{id}",
		func(w http.ResponseWriter, r *http.Request) { handleUpdateTodoInfo(w, r, updateTodoInfo) },
	)
}

func handleCreateTodo(w http.ResponseWriter, r *http.Request, handler *commands.CreateTodoHandler) {
	body := r.Context().Value("body").(CreateTodoDto)
	result, err := handler.Handle(r.Context(), &commands.CreateTodo{
		Title:       body.Title,
		Description: body.Description,
		Changelog:   body.Changelog,
		Status:      body.Status,
	})
	w.Header().Set("content-type", "application/json")
	if err != nil {
		httpStatus, body := serializeError(err)
		w.WriteHeader(httpStatus)
		json.NewEncoder(w).Encode(body)
		return
	}
	json.NewEncoder(w).Encode(map[string]any{
		"data": TodoItemResponse{
			Id:          result.ID,
			Title:       result.Title,
			Description: result.Description,
			Changelog:   result.Changelog,
			Status:      string(result.Status),
			CreatedDate: result.CreatedDate,
			UpdatedDate: result.UpdatedDate,
		},
	})
}

func handleListTodos(w http.ResponseWriter, r *http.Request, handler *queries.ListTodosHandler) {
	filter := r.Context().Value("query").(ListTodosFilterQuery)
	result, err := handler.Handle(r.Context(), &queries.ListTodos{
		Status: filter.Status,
	})
	w.Header().Set("content-type", "application/json")
	if err != nil {
		httpStatus, body := serializeError(err)
		w.WriteHeader(httpStatus)
		json.NewEncoder(w).Encode(body)
		return
	}
	items := make([]TodoItemResponse, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, TodoItemResponse{
			Id:          item.ID,
			Title:       item.Title,
			Description: item.Description,
			Changelog:   item.Changelog,
			Status:      string(item.Status),
			CreatedDate: item.CreatedDate,
			UpdatedDate: item.UpdatedDate,
		})
	}
	json.NewEncoder(w).Encode(ListTodosResponse{
		TotalCount: result.TotalCount,
		Items:      items,
	})
}

func handleGetTodoById(w http.ResponseWriter, r *http.Request, handler *queries.GetTodoByIdHandler) {
	result, err := handler.Handle(r.Context(), &queries.GetTodoById{
		ID: chi.URLParam(r, "id"),
	})
	w.Header().Set("content-type", "application/json")
	if err != nil {
		httpStatus, body := serializeError(err)
		w.WriteHeader(httpStatus)
		json.NewEncoder(w).Encode(body)
		return
	}
	json.NewEncoder(w).Encode(map[string]any{
		"data": TodoItemResponse{
			Id:          result.ID,
			Title:       result.Title,
			Description: result.Description,
			Changelog:   result.Changelog,
			Status:      string(result.Status),
			CreatedDate: result.CreatedDate,
			UpdatedDate: result.UpdatedDate,
		},
	})
}

func handleUpdateTodoInfo(w http.ResponseWriter, r *http.Request, handler *commands.UpdateTodoInfoHandler) {
	id := chi.URLParam(r, "id")
	body := r.Context().Value("body").(UpdateTodoInfoDto)
	input := commands.UpdateTodoInfo{
		ID:          id,
		Title:       body.Title,
		Description: body.Description,
		Changelog:   body.Changelog,
	}
	result, err := handler.Handle(r.Context(), &input)
	w.Header().Set("content-type", "application/json")
	if err != nil {
		httpStatus, body := serializeError(err)
		w.WriteHeader(httpStatus)
		json.NewEncoder(w).Encode(body)
		return
	}
	json.NewEncoder(w).Encode(map[string]any{
		"data": UpdateTodoInfoResponse{
			Id:          result.ID,
			Title:       result.Title,
			Description: result.Description,
			Changelog:   result.Changelog,
			UpdatedDate: result.UpdatedDate,
		},
	})
}

func serializeError(err error) (http_status int, body map[string]any) {
	var notFound domains.TodoNotFoundError
	if errors.As(err, &notFound) {
		code, message := notFound.Get()
		return http.StatusNotFound, map[string]any{
			"error": map[string]string{
				"code":    code,
				"message": message,
			},
		}
	}
	var domainErr shared.BaseDomainError
	if errors.As(err, &domainErr) {
		code, message := domainErr.Get()
		return http.StatusBadRequest, map[string]any{
			"error": map[string]string{
				"code":    code,
				"message": message,
			},
		}
	}
	return http.StatusInternalServerError, map[string]any{
		"error": map[string]string{
			"code":    "UNKNOWN_ERROR",
			"message": err.Error(),
		},
	}
}
