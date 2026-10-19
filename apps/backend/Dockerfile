FROM golang:1.26-alpine AS builder

WORKDIR /src

RUN apk add --no-cache git \
    && go install github.com/pressly/goose/v3/cmd/goose@v3.24.3

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/api ./cmd/api

FROM alpine:3.21 AS runner

WORKDIR /app

RUN apk add --no-cache ca-certificates wget \
    && adduser -D -H -u 10001 appuser

COPY --from=builder /out/api /app/api
COPY --from=builder /go/bin/goose /usr/local/bin/goose
COPY migrations /app/migrations
COPY docker-entrypoint.sh /app/docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh /app/api \
    && chown -R appuser:appuser /app

USER appuser

ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
