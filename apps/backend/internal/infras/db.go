package infras

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

type SetupDBConfig struct {
	DatabaseUrl string
}

func SetupDatabase(config SetupDBConfig) *pgxpool.Pool {
	ctx := context.Background()

	pool, err := pgxpool.New(ctx, config.DatabaseUrl)
	if err != nil {
		log.Fatal(err)
		return nil
	}

	if err := pool.Ping(ctx); err != nil {
		log.Fatal(err)
		return nil
	}

	return pool
}
