package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"todox-backend/internal/config"
	"todox-backend/internal/infras"
	"todox-backend/internal/todo/ports"
)

func main() {
	cfg, dbPool := setupInfras()

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "ok")
	})

	ports.Setup(r, dbPool)

	addr := ":" + cfg.Port
	log.Println("Listening on", addr)
	log.Fatal(http.ListenAndServe(addr, r))
}

func setupInfras() (config.Config, *pgxpool.Pool) {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	pool := infras.SetupDatabase(infras.SetupDBConfig{DatabaseUrl: cfg.DatabaseUrl})
	return cfg, pool
}
