package infras

import (
	"context"
	"encoding/json"
	"net/http"
	"reflect"
	"strings"

	"github.com/go-playground/form"
	"github.com/go-playground/validator/v10"
)

type InvalidData struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

type ValidateType string

const (
	BodyValidateType  ValidateType = "BODY"
	QueryValidateType ValidateType = "QUERY"
)

var validate = validator.New(validator.WithRequiredStructEnabled())
var formDecoder = form.NewDecoder()

func init() {
	validate.RegisterTagNameFunc(func(fld reflect.StructField) string {
		name, _, _ := strings.Cut(fld.Tag.Get("json"), ",")
		if name == "" || name == "-" {
			return fld.Name
		}
		return name
	})
}

func ValidateMiddleware[T any](validateType ValidateType) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch validateType {
			case BodyValidateType:
				handleBody[T](w, r, next)
			case QueryValidateType:
				handleQuery[T](w, r, next)
			default:
				next.ServeHTTP(w, r)
			}
		})
	}
}

func handleQuery[T any](w http.ResponseWriter, r *http.Request, next http.Handler) {
	var input T
	if err := formDecoder.Decode(&input, r.URL.Query()); err != nil {
		w.Write([]byte("Invalid URL query"))
		return
	}
	validationError := validate.Struct(input)
	if validationError != nil {
		var errs = validationError.(validator.ValidationErrors)
		writeValidationError(w, errs)
		return
	}
	ctx := context.WithValue(r.Context(), "query", input)
	next.ServeHTTP(w, r.WithContext(ctx))
}

func handleBody[T any](w http.ResponseWriter, r *http.Request, next http.Handler) {
	var input T
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		w.Write([]byte("Invalid JSON"))
		return
	}
	validationError := validate.Struct(input)

	if validationError != nil {
		var errs = validationError.(validator.ValidationErrors)
		writeValidationError(w, errs)
		return
	}
	ctx := context.WithValue(r.Context(), "body", input)
	next.ServeHTTP(w, r.WithContext(ctx))
}

func writeValidationError(w http.ResponseWriter, errs validator.ValidationErrors) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(&InvalidData{
		Error:   "validation_failed",
		Message: serializeErrorMessage(errs),
	})
}

func serializeErrorMessage(errs validator.ValidationErrors) string {
	var parts = make([]string, 0, len(errs))
	for _, err := range errs {
		if err.Tag() == "oneof" {
			parts = append(parts, err.Field()+" "+err.Tag()+": "+err.Param())
		} else {
			parts = append(parts, err.Field()+" "+err.Tag())
		}
	}
	return strings.Join(parts, ", ")
}
