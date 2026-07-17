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
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

Requirements:
1. `docker compose up` is running (backend on 3000, mcp-server on 3001)
2. Reload Cursor after saving the config (or toggle the server in **Customize → MCP**)

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

## REST API

### Todos

```
GET    /todos
POST   /todos
GET    /todos/:id
PATCH  /todos/:id
DELETE /todos/:id
```

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

Polls a deployment status endpoint via HTTP:

```json
{
  "url": "https://api.example.com/deployments/abc123",
  "expectedStatus": 200,
  "deploymentId": "abc123"
}
```

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
