package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port        string
	DatabaseUrl string
}

func Load() (Config, error) {
	_ = godotenv.Load()

	cfg := Config{
		Port:        getenv("PORT", "8080"),
		DatabaseUrl: getenv("DATABASE_URL", ""),
	}
	if cfg.DatabaseUrl == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}

	return cfg, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
