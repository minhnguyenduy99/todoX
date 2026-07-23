---
title: "feat: Todo changelog field and release assembly"
type: feat
date: 2026-07-23
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# feat: Todo changelog field and release assembly

## Goal Capsule

- **Objective:** Add an optional `changelog` text field on todos (parallel to `description`), expose it through API/MCP/web read paths, and automatically append member-todo changelogs grouped by service when creating or amending draft releases.
- **Authority:** User request overrides the prior release plan's "no server-side changelog assembly" deferral for ticket-based notes; this plan covers **todo-authored changelog text only**.
- **Stop conditions:** Block on schema/API contract conflicts or failing backend unit tests for todo CRUD and release content assembly — not on markdown formatting polish.
- **Execution profile:** Standard cross-cutting change across Prisma, shared types, Nest todos/releases, MCP, and web detail display.

---

## Product Contract

### Summary

Agents and operators can store release-note text per todo in an optional `changelog` field. When a release is created or its membership is amended while still `not_started`, the backend merges agent-provided release preamble with an auto-generated **Changelog by service** section built from member todos that have changelog text.

### Problem Frame

Release `content` today is entirely agent-authored at create time. Todo `description` holds general work context but is not structured for release notes, and nothing aggregates todo-level notes into the release record. Agents must manually copy todo notes into release content, which duplicates work and drifts from the todos that actually ship.

### Requirements

- R1. Todo exposes optional nullable `changelog: string | null` on read DTOs, mirroring `description` semantics (free text, no markdown validation server-side).
- R2. Todo create and update accept optional `changelog` through REST, MCP `create_todo` / `update_todo`, and backend validation DTOs.
- R3. Prod archive copies `changelog` onto `CompletedTodo` alongside existing core fields so historical release members retain the text.
- R4. On `POST /releases` (`create_release`), stored `content` = merged agent preamble + auto-generated changelog section from the initial member todos.
- R5. On `PATCH /releases/:id` while `not_started`, when `todoIdsToAdd` or `todoIdsToRemove` changes membership, regenerate the auto-generated changelog section from the **current** member set; preserve any agent preamble already stored.
- R6. Changelog assembly groups entries by service. Each service section lists that service's member todos that have non-empty `changelog` (trimmed). Todos without changelog are omitted from the assembled section.
- R7. Service section heading uses `service.displayName` when present, otherwise `service.keyName`. Services sort alphabetically by heading; todos within a service sort by title.
- R8. Each todo entry renders as a markdown bullet: `- **{title}** — {changelog}` (single line; internal newlines in changelog collapsed to spaces for v1).
- R9. If no member todo has changelog text, omit the entire auto-generated section (do not append an empty heading block).
- R10. Agent preamble is the release `content` before the fixed delimiter heading `## Changelog by service`. Content-only updates while `not_started` replace the preamble and keep the regenerated changelog section.
- R11. Web todo detail panel displays `changelog` read-only when present (same posture as `description` today).
- R12. MCP tool schemas document `changelog` on todo create/update.

### Actors

- A1. Coding agent — writes todo changelogs via MCP and creates releases; may still supply optional release preamble in `content`.
- A2. Human operator — reads todo changelog and assembled release content on the web Releases view.

### Key Flows

- F1. Agent sets `changelog` on todos while work progresses → field round-trips via MCP/API.
- F2. Agent creates staging/prod release with todo IDs + optional preamble → backend stores merged `content` with service-grouped changelog.
- F3. Agent appends/removes todos on a `not_started` release → backend refreshes the changelog section without losing preamble.
- F4. Prod deploy succeeds → archived `CompletedTodo` retains `changelog` for release history.

### Acceptance Examples

- AE1. `create_todo` with `changelog: "Fixed rounding on refunds"` → `get_todo` returns the field; `description` unchanged.
- AE2. Release members: billing-api todo A (changelog set), billing-api todo B (empty), auth todo C (changelog set) → assembled section has two service headings; todo B absent.
- AE3. Create release with preamble `"March staging cut"` and two changelogs → stored content starts with preamble, then delimiter, then grouped section.
- AE4. Append a third todo with changelog while `not_started` → changelog section grows; preamble unchanged.
- AE5. Prod archive → `completed_todos` row includes `changelog` copied from the source todo.

### Scope Boundaries

**In scope:** Prisma migration; shared types; Nest todo/release changes; pure release-content assembler helper; MCP schema/handler updates; web read display; backend unit tests; README MCP table row for `changelog`.

**Out of scope:** Web UI to edit changelog; markdown rendering preview; auto-generating changelog from tickets/PRs/commits; making release `content` optional; re-assembling changelog after release leaves `not_started`; subtask-level changelog.

#### Deferred to Follow-Up Work

- Editable changelog in web UI.
- Rich markdown block per todo (preserve newlines / lists).
- Dedicated `agentContent` column instead of delimiter split in `Release.content`.

### Success Criteria

- `changelog` persists and round-trips on todos via REST and MCP.
- Release create and draft membership updates produce correct service-grouped changelog in `Release.content`.
- Prod archive preserves `changelog` on `CompletedTodo`.
- Web todo detail shows changelog when set.
- Backend unit tests for assembler and release merge pass.

### Sources

- User request (optional todo `changelog`; include in release generation grouped by services).
- Existing patterns: `description` on `Todo` / `CompletedTodo`; release create in `apps/backend/src/releases/releases.service.ts`; prior release plan `docs/plans/2026-07-20-006-feat-release-generation-plan.md` (supersedes its ticket-based changelog deferral for this feature).

---

## Planning Contract

### Assumptions

- "Also include" means **append** an auto-generated section to agent-provided release preamble, not replace agent `content`.
- Delimiter-based preamble extraction in `Release.content` is acceptable for v1 (no new DB column).
- Collapsing internal newlines inside a todo changelog to spaces is acceptable for v1 bullet formatting.
- Display-only web surfacing matches current `description` UX (agents author via MCP/API).

### Key Technical Decisions

- KTD1. **Field parity with `description`.** Add nullable `changelog String?` on `Todo` and `CompletedTodo` in Prisma; mirror through `TodoDto`, create/update DTOs, class-validator bodies, `toTodoDto`, and prod archive copy in `archiveProdTodosForService`.
- KTD2. **Pure assembler helper.** New `apps/backend/src/common/release-content-assembler.ts` exports `assembleTodoChangelogSection(members)` returning `string | null` and `mergeReleaseContent(preamble, assembled)` returning final content. Keeps formatting testable without HTTP/MCP.
- KTD3. **Delimiter contract.** Auto-generated block always starts with `\n\n## Changelog by service\n\n` when non-empty. `extractReleasePreamble(content)` returns text before the first `\n## Changelog by service\n` marker; if absent, whole string is preamble.
- KTD4. **Write-time merge in ReleasesService.** `create` and draft `update` (membership or content changes while `not_started`) call assembler on loaded member todos (include `service` relation), merge, persist to `Release.content`. No read-time assembly — stored content is what agents and web display.
- KTD5. **MCP passthrough only.** Extend MCP todo tool schemas and argument mapping; no release logic in MCP layer.

### High-Level Technical Design

#### Release content merge

```text
create_release(content, todoIds)
  │
  ├─ load member todos (+ service)
  ├─ assembled = assembleTodoChangelogSection(members)  // null if no changelog text
  └─ store content = mergeReleaseContent(content, assembled)

update_release(todoIdsToAdd|Remove) [not_started]
  │
  ├─ apply membership change
  ├─ reload all members (+ service)
  ├─ preamble = extractReleasePreamble(existing.content)
  ├─ assembled = assembleTodoChangelogSection(members)
  └─ store content = mergeReleaseContent(preamble, assembled)
```

#### Assembled markdown shape (example)

```markdown
March staging cut

## Changelog by service

### Billing API
- **Fix refund rounding** — Fixed cent-level rounding on partial refunds.

### Auth
- **Extend session TTL** — Sessions now expire after 24 hours.
```

### Sequencing

1. Schema + shared types  
2. Todo API/MCP + mappers + archive copy  
3. Release content assembler + ReleasesService integration  
4. Web display + README  
5. Tests  

### Product Contract preservation

Product Contract authored by `ce-plan-bootstrap` for this feature; no upstream brainstorm artifact.

---

## Implementation Units

### U1. Prisma schema — todo and completed_todo changelog columns

**Goal:** Persist optional changelog on active and archived todos.

**Requirements:** R1, R3

**Dependencies:** None

**Files:**
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/<timestamp>_todo_changelog/migration.sql` (via migrate)

**Approach:**
- Add `changelog String?` to `Todo` model (after `description`).
- Add `changelog String?` to `CompletedTodo` model (after `description`).
- Generate and apply migration.

**Patterns to follow:** Existing optional `description` column on both models.

**Test scenarios:**
- Test expectation: none — migration-only; behavior covered in U2/U4.

**Verification:** `npm run prisma:migrate:dev -w @todo-platform/backend` applies cleanly; Prisma client regenerates.

---

### U2. Shared types, DTOs, mappers, and todo write paths

**Goal:** Expose `changelog` on todo DTOs and accept it on create/update; copy on prod archive.

**Requirements:** R1–R3, R12

**Dependencies:** U1

**Files:**
- `packages/shared-types/src/index.ts`
- `apps/backend/src/common/dto.ts`
- `apps/backend/src/common/mappers.ts`
- `apps/backend/src/todos/todos.service.ts`
- `apps/backend/src/releases/releases.service.ts` (`archiveProdTodosForService`)
- `apps/backend/src/todos/todos.service.spec.ts`

**Approach:**
- Add `changelog: string | null` to `TodoDto`; optional `changelog?: string` on `CreateTodoDto` / `UpdateTodoDto`.
- Add optional `@IsString() changelog` to `CreateTodoBody` / `UpdateTodoBody`.
- Map in `toTodoDto`; pass through in `todos.service` create/update Prisma data.
- Copy `changelog: todo.changelog` in `completedTodo.create` during prod archive.

**Patterns to follow:** Existing `description` field wiring in the same files.

**Test scenarios:**
- Happy path: create todo with changelog → DTO returns value.
- Happy path: update todo changelog to null/empty → persisted as null.
- Happy path: prod archive copies changelog onto `CompletedTodo`.
- Edge: omit changelog on create → null on read (same as description).

**Verification:** `npm run test -w @todo-platform/backend -- todos.service.spec.ts` passes; workspace typechecks.

---

### U3. MCP todo tools — schema and handlers

**Goal:** Agents can set and read todo changelog via MCP.

**Requirements:** R2, R12

**Dependencies:** U2

**Files:**
- `apps/mcp-server/src/index.ts`
- `README.md` (MCP tools table, if present)

**Approach:**
- Add `changelog` property to `create_todo` and `update_todo` input schemas with description mirroring description ("Optional release-note text for this todo").
- Pass `changelog` through in tool handler cases for create/update (same as `description`).

**Patterns to follow:** Existing `description` entries in MCP tool definitions and handler switch.

**Test scenarios:**
- Test expectation: none — MCP is thin proxy; contract documented in README.

**Verification:** Manual or existing MCP smoke path; shared-api types align.

---

### U4. Release content assembler and ReleasesService integration

**Goal:** Auto-append service-grouped todo changelogs into release content on create and draft membership updates.

**Requirements:** R4–R10

**Dependencies:** U2

**Files:**
- `apps/backend/src/common/release-content-assembler.ts` (new)
- `apps/backend/src/common/release-content-assembler.spec.ts` (new)
- `apps/backend/src/releases/releases.service.ts`
- `apps/backend/src/releases/releases.service.spec.ts`
- `apps/mcp-server/src/releases.ts` (update `content` description to mention auto-append)

**Approach:**
- Implement `assembleTodoChangelogSection` per R6–R9, KTD2–KTD3.
- Implement `extractReleasePreamble` and `mergeReleaseContent`.
- In `create`: after loading validated todos, compute merged content before `release.create`.
- In `update` while `not_started`: when `todoIdsToAdd`, `todoIdsToRemove`, or `content` is present, reload members and recompute merged content (content-only update replaces preamble via `extractReleasePreamble` on incoming content or uses explicit `dto.content` as new preamble).
- Update MCP `createReleaseSchema.content` description: optional preamble; service-grouped todo changelogs appended automatically.

**Patterns to follow:** Pure helpers like `apps/backend/src/common/release-deployment-status-sync.ts`; release membership loading in existing `ReleasesService`.

**Test scenarios:**
- Happy path: two services, three todos with changelog → two headings, three bullets, sorted.
- Happy path: todo without changelog omitted.
- Happy path: no changelogs on any member → assembler returns null; merge returns trimmed preamble only.
- Happy path: create with preamble + changelogs → delimiter present; preamble preserved.
- Happy path: append todo with changelog on draft release → new bullet appears; preamble unchanged.
- Happy path: remove last changelog todo → auto section omitted if none remain.
- Edge: todo with whitespace-only changelog treated as empty (omitted).
- Edge: changelog containing newlines collapsed to single-line bullet body.
- Error: membership update on `in_progress` release unchanged (existing guard; no reassembly).

**Verification:** `npm run test -w @todo-platform/backend -- release-content-assembler.spec.ts releases.service.spec.ts` passes.

---

### U5. Web display and documentation

**Goal:** Operators see todo changelog in the detail panel; agents discover the field in docs.

**Requirements:** R11

**Dependencies:** U2

**Files:**
- `apps/web/src/components/SubtaskPanel.tsx`
- `apps/web/src/index.css` (reuse existing description styles or add `.subtask-panel-changelog` if needed)
- `README.md`

**Approach:**
- Add a **Changelog** block below **Description** in `SubtaskPanel`, mirroring empty/present states.
- Optionally show changelog on compact cards is out of scope — detail panel only.
- Document MCP `changelog` on create/update todo; note release auto-assembly in create/update release tool descriptions.

**Patterns to follow:** Description block in `SubtaskPanel.tsx` lines ~102–107.

**Test scenarios:**
- Test expectation: none — display-only UI; manual smoke on todo with changelog.

**Verification:** Web build succeeds; todo with changelog shows in side panel.

---

## Verification Contract

Run from repo root:

```bash
npm run build
npm run test -w @todo-platform/backend
npm run lint
```

Focused during development:

```bash
npm run test -w @todo-platform/backend -- release-content-assembler
npm run test -w @todo-platform/backend -- releases.service
npm run test -w @todo-platform/backend -- todos.service
```

Optional integration (if release integration specs exist):

```bash
npm run test:integration -w @todo-platform/backend
```

---

## Definition of Done

- [ ] `Todo.changelog` and `CompletedTodo.changelog` exist in schema and migration applied
- [ ] REST/MCP todo create/update round-trip `changelog`
- [ ] Release create and draft membership update merge service-grouped changelog into `Release.content` per KTD3 delimiter rules
- [ ] Prod archive copies `changelog`
- [ ] Web todo detail shows changelog read-only
- [ ] Backend unit tests for assembler and affected services pass
- [ ] README MCP documentation updated

---

## Open Questions

| Question | Status | Notes |
|----------|--------|-------|
| Should compact todo cards show changelog? | Deferred | Out of scope; detail panel only for v1 |
| Separate DB column for agent preamble vs delimiter split? | Deferred | Delimiter split chosen for minimal schema change |
