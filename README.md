# Todo Platform

A production-ready **MCP-based Todo Management Platform** that lets AI coding assistants (Cursor, Claude Desktop, etc.) manage todos through an MCP server, while humans interact via a real-time web dashboard.

## Architecture

```
Cursor / Claude Desktop / MCP Client
                │
         MCP Protocol
                │
        Node.js MCP Server          (port 3001)
                │
         REST / WebSocket API
                │
        Todo Backend Service        (port 3000)
                │
           PostgreSQL               (port 5432)
                │
        Background Scheduler
                │
              Redis                 (port 6379)
                │
      External Monitoring APIs
                │
        WebSocket Notifications
                │
           React Dashboard          (port 5173)
```

The **MCP server contains no business logic** — it exposes tools that proxy to the backend REST API. All business logic lives in the NestJS backend.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Backend | Node.js, TypeScript, NestJS, Prisma, PostgreSQL, BullMQ, Redis, WebSocket |
| MCP Server | `@modelcontextprotocol/sdk` |
| Frontend | React, Vite, TypeScript, TanStack Query |
| Infrastructure | Docker, Docker Compose |

## Quick Start (Docker)

```bash
# Clone and start all services
docker compose up --build

# Services:
# - Backend API:    http://localhost:3000
# - Swagger docs:   http://localhost:3000/api
# - MCP Server:     http://localhost:3001/mcp
# - Web Dashboard:  http://localhost:5173
# - PostgreSQL:     localhost:5432
# - Redis:          localhost:6379
```

Migrations run automatically on backend startup.

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL 16
- Redis 7

### Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start PostgreSQL and Redis (or use Docker for just infra)
docker compose up postgres redis -d

# Generate Prisma client and run migrations
npm run prisma:generate --workspace=@todo-platform/backend
npm run prisma:migrate --workspace=@todo-platform/backend

# Build shared packages
npm run build --workspace=@todo-platform/shared-types
npm run build --workspace=@todo-platform/shared-api

# Start backend (terminal 1)
npm run start:dev --workspace=@todo-platform/backend

# Start web dashboard (terminal 2)
npm run dev --workspace=@todo-platform/web

# Start MCP server on stdio (terminal 3)
npm run start:dev --workspace=@todo-platform/mcp-server
```

## MCP Server Configuration

Cursor reads MCP config from `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global).

### Docker Compose (recommended)

When you run `docker compose up`, the MCP server is already running on **HTTP port 3001**. You do **not** need a local `node` path or a built `dist/` folder.

Use this config in `.cursor/mcp.json` or your global MCP settings:

```json
{
  "mcpServers": {
    "todo-platform": {
      "type": "streamableHttp",
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

Requirements:
1. `docker compose up` is running (backend on 3000, mcp-server on 3001)
2. Toggle the server off and on in **Settings → Tools & MCP**, then open a **new Agent chat** (reload alone may not refresh tool schemas)

A ready-to-use project config is included at `.cursor/mcp.json`.

### Local stdio (without Docker MCP container)

Use this if you run the backend via Docker but want Cursor to spawn the MCP process locally:

```bash
npm install
npm run build --workspace=@todo-platform/shared-types
npm run build --workspace=@todo-platform/shared-api
npm run build --workspace=@todo-platform/mcp-server
```

```json
{
  "mcpServers": {
    "todo-platform": {
      "command": "node",
      "args": ["${workspaceFolder}/apps/mcp-server/dist/index.js"],
      "env": {
        "BACKEND_URL": "http://localhost:3000",
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

`${workspaceFolder}` resolves to your project root automatically — do **not** use `/path/to/todo-platform/`.

See `mcp-config.example.json` for both Docker and local examples.

## MCP Tools

| Tool | Description |
|------|-------------|
| `create_todo` | Create a new todo |
| `list_todos` | List all todos with subtasks and monitors |
| `get_todo` | Get a single todo by ID |
| `update_todo` | Update a todo |
| `delete_todo` | Delete a todo |
| `create_subtask` | Add a subtask to a todo (optionally with an attached monitor) |
| `update_subtask` | Update a subtask (optionally update or add its monitor) |
| `delete_subtask` | Delete a subtask (and its monitor, if any) |
| `add_associated_pull_request` | Associate a PR with a todo or subtask (flat parameters; appends to existing PRs) |
| `add_associated_ticket` | Associate an external feature/bug ticket with a todo (flat parameters; appends to existing tickets, same link updates in place). When linking Jira, set `title` to the Jira ticket title. |
| `list_services` | List all predefined services |
| `get_service` | Get a service by ID |
| `create_service` | Add a service to the catalog (`keyName` slug, optional `displayName`) |
| `update_service` | Update a service `displayName` (`keyName` is immutable) |
| `delete_service` | Delete a service (clears association on referencing todos) |

`create_todo`, `update_todo`, `create_subtask`, and `update_subtask` also accept an optional `pullRequest` object (singular) for agents that cannot pass array parameters. Use `add_associated_pull_request` when you only need to link a PR.

`create_todo` and `update_todo` also accept optional `associatedTickets` (full list) or `associatedTicket` (singular, appends one). Use `add_associated_ticket` when you only need to link a ticket on an existing todo. For Jira links, the MCP tool descriptions require using the Jira issue title as `title`.

`create_todo` and `update_todo` also accept optional `serviceId` and/or `serviceKeyName` to assign a predefined service to the todo. Prefer `serviceKeyName` for agents. Pass `null` on either field to clear the association.

## REST API

### Todos

```
GET    /todos
POST   /todos
GET    /todos/:id
PATCH  /todos/:id
DELETE /todos/:id
```

### Services

```
GET    /services
POST   /services
GET    /services/:id
PATCH  /services/:id
DELETE /services/:id
```

Todo `POST` / `PATCH` bodies accept optional `serviceId` and/or `serviceKeyName` to assign a catalog service.

### Subtasks

```
POST   /todos/:todoId/subtasks
PATCH  /todos/:todoId/subtasks/:subtaskId
DELETE /todos/:todoId/subtasks/:subtaskId
```

### Monitors

```
GET    /monitors
GET    /monitors/:id
POST   /subtasks/:subtaskId/monitors
PATCH  /monitors/:id
DELETE /monitors/:id
```

### Health

```
GET    /health
```

OpenAPI documentation is available at `/api` when the backend is running.

## WebSocket Events

Connect to `ws://localhost:3000/ws` for real-time updates:

- `todo.created`, `todo.updated`, `todo.deleted`
- `subtask.created`, `subtask.updated`, `subtask.deleted`
- `monitor.created`, `monitor.updated`, `monitor.deleted`

## Monitor Providers

The scheduler uses a plugin architecture. Providers are resolved by `type`:

### HTTP Monitor (`http`)

```json
{
  "url": "https://example.com/status",
  "method": "GET",
  "expectedStatus": 200
}
```

### GitHub PR Monitor (`github_pr`)

```json
{
  "owner": "my-org",
  "repo": "backend",
  "pullNumber": 123
}
```

Set `GITHUB_TOKEN` for higher rate limits. Returns `success` when merged, `running` otherwise.

### Deployment Monitor (`deployment`)

Polls a Jenkins build via the Jenkins REST API:

```json
{
  "env": "dev",
  "jobUrl": "https://jenkins2.example.net/job/backend-nodejs.backend.dev.deploy",
  "buildNumber": 2790
}
```

Set `JENKINS_AUTH` to the base64-encoded `user:password` token (sent as `Authorization: Basic …`). Returns `running` while the build is in progress, `success` on `SUCCESS`, `failed` on `FAILURE`/`ABORTED`/`UNSTABLE`. Structured deployment info is available in `lastResult.metadata.deployment`.

Monitors can attach to a **todo** or a **subtask** (at most one per entity). For todo-level deployments, pass `monitor` on `create_todo` / `update_todo` (MCP) or `POST /todos` / `PATCH /todos/:id` (REST) alongside `deployedEnvironments`:

```json
{
  "title": "Release backend",
  "deployedEnvironments": ["dev"],
  "monitor": {
    "type": "deployment",
    "cron": "*/5 * * * *",
    "config": {
      "env": "dev",
      "jobUrl": "https://jenkins2.example.net/job/backend-nodejs.backend.dev.deploy",
      "buildNumber": 2790
    }
  }
}
```

Todo-level monitors update deployment chips on the todo; they do not change subtask status. Subtask monitors still sync subtask status from poll results.

When a **UAT** deployment monitor (todo or subtask) reports success for the first time, the parent todo status is set to `TESTING` automatically. When a **uat-main** deployment monitor reports success for the first time, the todo status is set to `WAIT_FOR_STAGING`.

## Project Structure

```
todo-platform/
├── docker-compose.yml
├── apps/
│   ├── backend/          # NestJS API, scheduler, WebSocket
│   ├── mcp-server/       # MCP tool server (REST proxy)
│   └── web/              # React dashboard
└── packages/
    ├── shared-types/     # DTOs, enums, WebSocket events
    └── shared-api/       # REST API client
```

## Testing

```bash
# Unit tests
npm test --workspace=@todo-platform/backend

# Integration tests (requires running PostgreSQL + Redis)
DATABASE_URL=postgresql://todo:todo@localhost:5432/todo_platform \
REDIS_URL=redis://localhost:6379 \
npm run test:integration --workspace=@todo-platform/backend
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `PORT` | `3000` | Backend port |
| `GITHUB_TOKEN` | — | GitHub API token for PR monitors |
| `JENKINS_AUTH` | — | Base64 `user:password` for Jenkins deployment monitors |
| `BACKEND_URL` | `http://localhost:3000` | Backend URL for MCP server |
| `MCP_TRANSPORT` | `stdio` | MCP transport (`stdio` or `http`) |
| `MCP_PORT` | `3001` | MCP HTTP port |
| `RUN_MIGRATIONS` | `false` | Run Prisma migrations on startup |

## Extending

### Add a Monitor Provider

1. Implement `MonitorProvider` in `apps/backend/src/monitors/providers/`
2. Register it in `MonitorProviderRegistry`
3. Add the type to `MonitorType` enum in `shared-types`

### Add an MCP Tool

1. Add the tool definition in `apps/mcp-server/src/index.ts`
2. Add a handler that calls the appropriate `TodoApiClient` method
3. Add the API method to `shared-api` if needed

## License

MIT
