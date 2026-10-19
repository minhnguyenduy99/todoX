#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Running database migrations..."
  goose -dir /app/migrations postgres "${DATABASE_URL}" up
fi

exec /app/api
