---
title: External Ticket Link on Todo - Plan
type: feat
date: 2026-07-20
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# External Ticket Link on Todo - Plan

## Goal Capsule

- **Objective:** Let each todo optionally reference one external feature or bug ticket (e.g. Jira) with `title`, `type` (`feature` | `bug`), and `link`, exposed through REST, MCP tools, and the read-only dashboard.
- **Authority:** Product Contract defines behavior; Planning Contract defines inline-column storage and MCP ergonomics; Implementation Units define execution order.
- **Stop conditions:** Block only on schema/API contract conflicts or failing verification gates — not on cosmetic UI polish.
- **Execution profile:** Standard layered change across shared types, backend, MCP, web display, and tests.

---

## Product Contract

### Summary

Add an optional, todo-scoped external ticket association (max one per todo) with `title`, `type` (`feature` | `bug`), and `link`. Agents set it via MCP; for Jira links the MCP tool description requires copying the Jira issue title into the association `title` field. The web dashboard displays the link as a chip. No Jira API integration — the link is an opaque URL.

### Problem Frame

Todo items track implementation work but have no structured way to point back to the originating feature request or bug report in an external tracker. Agents and humans need a single, visible association per todo so work stays traceable to its source ticket without embedding URLs in free-text descriptions.

### Requirements

#### Association data

- R1. Each todo may have zero or one associated external ticket.
- R2. When present, the association includes `title` (string), `type` (enum: `feature` | `bug`), and `link` (URL string).
- R3. The association is todo-scoped only — subtasks do not carry their own external ticket.
- R4. All three fields are set together or cleared together; partial associations are invalid.

#### API and persistence

- R5. `POST /todos` and `PATCH /todos/:id` accept an optional nested `associatedTicket` object matching R2.
- R6. `PATCH` with `associatedTicket: null` clears the association; omitting `associatedTicket` leaves it unchanged.
- R7. `GET /todos` and `GET /todos/:id` return `associatedTicket` when set, otherwise `null`.
- R8. `link` is validated as a URL; `type` is validated as `feature` or `bug`; `title` is a non-empty string.

#### MCP agent surface

- R9. `create_todo` and `update_todo` accept an optional `associatedTicket` object with `title`, `type`, and `link`.
- R10. A dedicated `set_associated_ticket` MCP tool sets or replaces the association on an existing todo (todo-level only).
- R11. MCP tool descriptions for `associatedTicket` and `set_associated_ticket` state that when linking a Jira issue, the agent must set `title` to the Jira ticket's title (not a paraphrase or todo title).

#### UI

- R12. The read-only dashboard displays the associated ticket on todo cards and in the detail panel when present, with visual distinction between `feature` and `bug` types.

### Scope Boundaries

**In scope:** Prisma migration (inline columns), shared types, backend validation/service/mappers, MCP schema and handler, web display component, integration and unit tests, README MCP tools table.

**Out of scope:** Jira (or any tracker) API fetch/sync, subtask-level tickets, multiple tickets per todo, edit UI on the web dashboard.

#### Deferred to Follow-Up Work

- Auto-populate title/type from Jira URL via API.
- Subtask-level external ticket associations.
- Editable ticket association from the web UI.

### Success Criteria

- Creating a todo with `associatedTicket` via REST or MCP persists and returns the association.
- Replacing or clearing the association via `PATCH` or `set_associated_ticket` behaves per R6.
- Dashboard shows a clickable chip with type styling when a ticket is linked.
- Backend test suite passes including new association scenarios.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Inline columns on `todos`** — store `associatedTicketTitle`, `associatedTicketType`, `associatedTicketLink` as nullable columns on the `Todo` model (user-confirmed over a separate table). Rationale: max-one constraint is inherent; fewer joins and sync helpers than a related entity; unlike PRs (many) or monitors (complex lifecycle), this is a simple optional triple.
- KTD2. **Nested API shape** — expose `associatedTicket: { title, type, link } | null` in DTOs rather than flat column names. Rationale: matches agent mental model and PR nested patterns; mapper bridges Prisma columns to API object.
- KTD3. **Dedicated MCP tool** — add `set_associated_ticket` mirroring `add_associated_pull_request` ergonomics but with replace semantics (max one). Rationale: agents often link tickets after todo creation; flat params are easier than nested PATCH for single-purpose actions.
- KTD4. **Jira title in tool description only** — enforce the Jira-title rule via MCP `description` text, not server-side Jira validation. Rationale: no Jira integration; agents read tool docs at call time.
- KTD5. **Atomic validation** — backend rejects requests where some but not all three inline fields would be set. Rationale: prevents orphaned column data.

### High-Level Technical Design

```mermaid
flowchart LR
  MCP[MCP Server] -->|REST| API[NestJS Todos API]
  API --> SVC[TodosService]
  SVC --> DB[(PostgreSQL todos row)]
  API --> WS[WebSocket broadcast]
  WS --> WEB[React Dashboard]
  SVC --> MAP[mappers.ts]
  MAP --> DTO[TodoDto.associatedTicket]
```

**Update semantics:**

| Action | `associatedTicket` in body | Result |
|---|---|---|
| Create with ticket | `{ title, type, link }` | All three columns set |
| Replace ticket | `{ title, type, link }` | Columns overwritten |
| Clear ticket | `null` | All three columns set to null |
| No change | omitted | Columns unchanged |

### Assumptions

- External ticket links are opaque URLs; no hostname-based type inference.
- Enum values in API/MCP use lowercase `feature` | `bug` (matching existing status enum style in MCP schemas).

### Sequencing

Shared types and migration first, then backend, then MCP, then web display, then tests/docs.

---

## Implementation Units

### U1. Schema migration and shared types

**Goal:** Add persistence columns and TypeScript contracts for the associated ticket.

**Requirements:** R1–R4, R7

**Dependencies:** None

**Files:**
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/<timestamp>_add_associated_ticket_to_todos/migration.sql`
- `packages/shared-types/src/index.ts`

**Approach:**
- Add `AssociatedTicketType` enum (`feature`, `bug`) to Prisma schema.
- Add nullable columns on `Todo`: `associatedTicketTitle`, `associatedTicketType`, `associatedTicketLink`.
- Add `AssociatedTicketDto`, `AssociatedTicketInput`, and optional `associatedTicket` on `TodoDto` and `CreateTodoDto`; on `UpdateTodoDto` use `associatedTicket?: AssociatedTicketInput | null` so `null` clears the association.

**Patterns to follow:** Existing enum and column naming in `schema.prisma`; DTO nesting style from `AssociatedPullRequestDto` in `packages/shared-types/src/index.ts`.

**Test scenarios:**
- Test expectation: none — schema/types only; covered by U2 integration tests.

**Verification:** `npx prisma migrate dev` succeeds; `packages/shared-types` builds without type errors.

---

### U2. Backend validation, service, and mappers

**Goal:** Accept, validate, persist, and return `associatedTicket` through the todos REST API.

**Requirements:** R4–R8

**Dependencies:** U1

**Files:**
- `apps/backend/src/common/associated-ticket.dto.ts` (new)
- `apps/backend/src/common/dto.ts`
- `apps/backend/src/common/mappers.ts`
- `apps/backend/src/todos/todos.service.ts`
- `apps/backend/test/todos.integration-spec.ts`
- `apps/backend/src/todos/todos.service.spec.ts`

**Approach:**
- Create `AssociatedTicketBody` with `@IsString() @IsNotEmpty()` on `title`, `@IsEnum(AssociatedTicketType)` on `type`, `@IsUrl()` on `link` (mirror `pull-request.dto.ts`).
- Extend `CreateTodoBody` / `UpdateTodoBody` with optional `@ValidateNested()` `associatedTicket` and allow `null` on update for clear semantics.
- In `toTodoDto`, map three columns to `associatedTicket` object or `null` when all columns null.
- In `TodosService.create` / `update`, spread `associatedTicket` fields into Prisma `data` or set all three to `null` when `associatedTicket === null`.
- Reject partial objects at validation layer (all fields required when object is present).

**Patterns to follow:** `apps/backend/src/common/pull-request.dto.ts` for URL validation; `apps/backend/src/common/mappers.ts` `toAssociatedPullRequestDto` for nested mapping.

**Test scenarios:**
- Happy path: `POST /todos` with `associatedTicket` returns nested object with correct `title`, `type`, `link`.
- Happy path: `PATCH /todos/:id` replaces an existing association with a new one.
- Happy path: `PATCH /todos/:id` with `associatedTicket: null` clears a previously set association.
- Edge case: `PATCH` omitting `associatedTicket` leaves existing association unchanged.
- Error path: `POST /todos` with `associatedTicket` missing `link` returns 400.
- Error path: `POST /todos` with invalid `type` value returns 400.
- Error path: `POST /todos` with non-URL `link` returns 400.
- Integration: WebSocket `todo.updated` payload includes `associatedTicket` after PATCH.

**Verification:** New integration tests pass; existing todo tests remain green.

---

### U3. MCP server tools and Jira title guidance

**Goal:** Expose associated ticket fields on MCP tools with explicit Jira title instructions.

**Requirements:** R9–R11

**Dependencies:** U2

**Files:**
- `apps/mcp-server/src/associated-ticket.ts` (new)
- `apps/mcp-server/src/index.ts`
- `README.md`

**Approach:**
- Add `associatedTicketSchema` object schema with `title`, `type` (`feature` | `bug`), `link`.
- Extend `create_todo` and `update_todo` `inputSchema` with optional `associatedTicket` using that schema.
- Add tool `set_associated_ticket` with flat params: `todoId`, `title`, `type`, `link` — calls `api.updateTodo(todoId, { associatedTicket: { ... } })`.
- Tool descriptions must include: *"When linking a Jira issue, set `title` to the Jira ticket's title exactly as shown in Jira (do not use the todo title or a summary)."* Place this in both `set_associated_ticket.description` and the `associatedTicket` property description on create/update tools.
- Wire handler in `CallToolRequestSchema` switch; resolve create/update args to pass `associatedTicket` through to `TodoApiClient`.

**Patterns to follow:** `apps/mcp-server/src/pull-requests.ts` for schema extraction and dedicated tool shape; `add_associated_pull_request` registration in `index.ts`.

**Test scenarios:**
- Test expectation: none — no MCP server test harness today; manual smoke via MCP client or integration through REST in U2 proves the contract.

**Verification:** MCP server starts; `list_tools` includes `set_associated_ticket` with Jira title note in description; calling the tool updates a todo visible via `GET /todos/:id`.

---

### U4. Web dashboard display

**Goal:** Show the associated ticket on todo cards and detail panel.

**Requirements:** R12

**Dependencies:** U2

**Files:**
- `apps/web/src/components/AssociatedTicketChip.tsx` (new)
- `apps/web/src/components/TodoCard.tsx`
- `apps/web/src/components/SubtaskPanel.tsx`
- `apps/web/src/index.css`

**Approach:**
- Create `AssociatedTicketChip` accepting `associatedTicket` prop; render a link chip with type badge (`feature` vs `bug`) and truncated title.
- Use distinct CSS classes for feature (e.g. blue) and bug (e.g. red/orange), following `.pr-*` chip patterns in `PullRequestList.tsx`.
- Render chip in `TodoCard` header row alongside PR and environment lists when `todo.associatedTicket` is non-null.
- Render chip in `SubtaskPanel` todo header section for kanban detail view.

**Patterns to follow:** `apps/web/src/components/PullRequestList.tsx` for compact link chips; `DeployedEnvironmentList.tsx` for optional compact mode.

**Test scenarios:**
- Test expectation: none — read-only UI; manual smoke in browser.

**Verification:** Dashboard renders chip for todos with `associatedTicket`; no chip when null; link opens in new tab.

---

### U5. Documentation

**Goal:** Document the new MCP tool and association fields for agent consumers.

**Requirements:** R9–R11

**Dependencies:** U3

**Files:**
- `README.md`

**Approach:**
- Add `set_associated_ticket` to the MCP tools table with parameter summary.
- Note `associatedTicket` on `create_todo` / `update_todo`.
- Include the Jira title requirement in the tool description column or a short "Agent notes" bullet.

**Patterns to follow:** Existing MCP tools table format in `README.md` around the `add_associated_pull_request` entry.

**Test scenarios:**
- Test expectation: none — documentation only.

**Verification:** README accurately lists tool name, params, and Jira title guidance.

---

## Verification Contract

| Gate | Command | Applies to |
|---|---|---|
| Unit tests | `npm test --workspace=@todo-platform/backend` | U2 |
| Integration tests | `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/todox REDIS_URL=redis://localhost:6379 npm run test:integration --workspace=@todo-platform/backend` | U2 |
| Type check (shared) | `npm run build --workspace=@todo-platform/shared-types` | U1 |
| MCP smoke | Start mcp-server; `list_tools` / call `set_associated_ticket` | U3 |
| Web smoke | `npm run dev --workspace=@todo-platform/web` with seeded todo | U4 |

---

## Definition of Done

- [ ] Prisma migration applied; `Todo` row stores nullable `associatedTicket*` columns.
- [ ] `TodoDto.associatedTicket` round-trips through create, update (replace), update (clear), and list/get.
- [ ] MCP `set_associated_ticket` and create/update `associatedTicket` work end-to-end.
- [ ] MCP tool descriptions document the Jira title requirement.
- [ ] Dashboard displays type-styled ticket chip when association exists.
- [ ] Integration tests cover happy path, clear, omit-unchanged, and validation errors.
- [ ] README MCP tools table updated.
- [ ] No dead experimental code or commented-out scaffolding in the diff.

---

## Sources & Research

- `apps/backend/prisma/schema.prisma` — current `Todo` model; no ticket fields today.
- `apps/mcp-server/src/pull-requests.ts` — MCP schema and dedicated-tool pattern to mirror.
- `apps/backend/src/common/pull-request.dto.ts` — `@IsUrl()` validation precedent.
- `apps/backend/test/todos.integration-spec.ts` — PR association integration test template.
- `apps/web/src/components/PullRequestList.tsx` — link chip UI precedent.
- User scope confirmation: inline columns on `Todo` (not separate table).
