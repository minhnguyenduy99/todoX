# TodoX

Todo management platform. The Go HTTP API stores todos in PostgreSQL and owns the business rules.

The README still describes a NestJS, Prisma, and BullMQ API. This checkout's API is the Go service in `apps/backend/`. When the README and the code disagree, follow the code.

# Components

## backend

`apps/backend/`. Go module `todox-backend`. HTTP API (chi, pgx) and the only place for domain rules and persistence. Owns the todo aggregate, command and query handlers, PostgreSQL access, and REST routes. SQL migrations live in `apps/backend/migrations/`.

# code style & conventions

## backend (golang)

The backend is written in golang following DDD, CQRS architecture.

Each bounded context lives under `internal/<context>/` and is split the same way `internal/todo/` is:

- `domains` — aggregates, value objects, invariants, and domain errors. Construct aggregates with factory functions (`CreateNew`). Change them through methods on the aggregate (`UpdateInfo`, `UpdateStatus`, `AddTicket`). This package does not import HTTP, SQL, or chi.
- `commands` — write use cases. One file per use case, with the command struct, result struct, and handler (`CreateTodo`, `CreateTodoResult`, `CreateTodoHandler`).
- `queries` — read use cases, same shape as commands (`ListTodos`, `GetTodoById`). Queries use the read model, not the write repository.
- `interfaces` — application ports. Writes go through `ITodoRepository`. Reads go through `ITodoReadModel` and its `TodoReadModel` DTO.
- `ports` — driving adapters. Chi routes, request DTOs, response mapping, and HTTP error serialization. `Setup` builds the Postgres adapter; `Register` wires handlers and is what tests call.
- `adapters` — driven adapters. `PostgresTodoRepository` implements both `ITodoRepository` and `ITodoReadModel`. `InMemRepository` is the in-memory stand-in used by HTTP tests. SQL and column mapping stay here.

Cross-cutting packages:

- `cmd/api` — composition root. Load config, open the pool, mount routes.
- `internal/config` — environment (`PORT`, `DATABASE_URL`).
- `internal/infras` — database pool and request validation middleware.
- `internal/shared` — `BaseDomainError`.

Patterns to follow:

- A handler is a struct holding its port, with `Handle(ctx, input)`. Construct handlers in `ports.Register`. Commands depend only on `ITodoRepository`. Queries depend only on `ITodoReadModel`.
- Repository writes take a callback so the aggregate is built or changed inside the persistence transaction. `Create` receives `func() *domains.Todo`. `Update` loads the row `FOR UPDATE`, then receives `func(todo *domains.Todo) (error, *domains.Todo)`. The adapter persists whatever the callback returns.
- Domain timestamps are Unix seconds (`int64`). The adapter converts them to `timestamptz`. Identifiers are UUID strings created in the domain.
- Adapters declare the interfaces they implement: `var _ interfaces.ITodoRepository = (*PostgresTodoRepository)(nil)`.
- HTTP input is a DTO with `validate` tags. Wrap the route in `infras.ValidateMiddleware[T]("BODY")` or `("QUERY")`. The middleware stores the parsed value on the request context as `"body"` or `"query"`. Handlers map that DTO into a command or query, call `Handle`, then map the result to a response struct. Do not put domain rules in the HTTP layer.
- Domain errors are structs in `domains` that implement `shared.BaseDomainError`: `Get() (code, message)` and `Error()`. `ports.serializeError` maps `TodoNotFoundError` to 404, any other `BaseDomainError` to 400, and anything else to 500 with code `UNKNOWN_ERROR`.
- Repository, read-model, and several domain helpers return `(error, value)`, with the error first. Match that order when adding methods on those types.
- Source files are kebab-case, one use case per file (`create-todo.go`, `get-by-id.go`). Interface files end in `.interface.go`.

# Important rules

- NEVER change the API contract nor database without user asking to do so. If it is critical to fulfill the requirement that user has not been aware yet, stop immediately and notice the user about this.

## Domain Driven Design rules

- In the domain layer, always use names that already exist in the business domain. Do not introduce a new concept.

Good. The parameter is a `[]TicketId`, and `TicketId` is the domain name:

```go
func (t *Todo) RemoveTickets(ids []TicketId) shared.BaseDomainError
```

Bad. `refs` is not a concept in this domain:

```go
func (t *Todo) RemoveTickets(refs []TicketId) shared.BaseDomainError
```
