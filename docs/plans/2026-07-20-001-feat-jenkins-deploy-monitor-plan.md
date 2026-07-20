---
title: Jenkins Deployment Monitor - Plan
type: feat
date: 2026-07-20
origin: docs/requirements/jenkin_deploy_monitor.md
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: legacy-requirements
execution: code
---

# Jenkins Deployment Monitor - Plan

## Goal Capsule

- **Objective:** Monitor Jenkins deployment builds for todo/subtask items and surface live deployment status (env, job, build, duration, outcome) through the backend API, MCP tools, and web dashboard environment chips.
- **Authority:** This plan, then `docs/requirements/jenkin_deploy_monitor.md` for product intent.
- **Stop conditions:** Block only on unresolved Jenkins credential configuration in target environments; defer multi-CI support beyond Jenkins.
- **Execution profile:** Standard backend-first sequencing — shared types, provider, API enrichment, then UI.
- **Tail ownership:** Implementer runs verification contract before marking done.

---

## Product Contract

### Summary

Repurpose the existing `deployment` monitor type to poll Jenkins build API, return structured deployment info on monitor results and environment DTOs, and show live status (with an in-progress animation) on environment chips in the web UI.

**Product Contract preservation:** Unchanged from origin; scope narrowed at user direction to repurpose `deployment` instead of adding a new monitor type.

### Problem Frame

Todo items track deployed environments as static chips (`dev`, `uat`, `uat-main`, `staging`) but give no visibility into whether a deployment is in progress, succeeded, or failed. Deployments run on Jenkins; the platform already has a cron-based monitor plugin architecture (HTTP, GitHub PR, and a generic deployment stub) but the deployment provider does not call Jenkins or expose the fields operators need.

### Requirements

#### Monitor system

- R1. Extend the monitor plugin architecture with a Jenkins-backed `deployment` provider; the registry pattern must remain the extension point for future monitor types.
- R2. Repurpose `MonitorType.DEPLOYMENT` and replace the generic HTTP deployment stub with Jenkins API polling (user-confirmed scope decision).
- R3. Monitor config must carry enough information to poll a specific Jenkins build: environment name, Jenkins job URL (or base URL + job path), and build number.
- R4. Poll Jenkins using the build JSON API with `tree=building,result,duration,timestamp,url` (see origin sample cURL).
- R5. Map Jenkins fields to platform deployment status:
  - `building: true` → `in_progress`
  - `building: false` + `result: SUCCESS` → `success`
  - `building: false` + `result` in `FAILURE`, `ABORTED`, `UNSTABLE` → `fail`
  - `building: false` + missing/null `result` → `in_progress` (queued or not yet finalized)
- R6. Structured deployment info on each check must include: `env`, `jobName`, `buildNumber`, `durationMs`, `status` (`in_progress` | `success` | `fail`), plus `buildUrl` and `timestamp` when available from Jenkins.
- R7. Jenkins authentication uses a server-wide `JENKINS_AUTH` env var holding the base64-encoded `user:password` token (provider sends `Authorization: Basic ${JENKINS_AUTH}`); per-monitor config does not store secrets.

#### API and MCP

- R8. Backend API responses must expose full deployment info on monitor `lastResult.metadata.deployment`.
- R9. When a todo or subtask has deployed environment chips, enrich matching `DeployedEnvironmentDto` entries with the latest deployment info from an active `deployment` monitor whose config `env` matches the chip name.
- R10. Todo-level environment chips aggregate deployment status from subtask monitors (most recent `lastRunAt` wins per env); subtask-level chips use that subtask's monitor only.
- R11. MCP tool schemas for `create_subtask` / `update_subtask` monitor config must document the Jenkins deployment config shape.

#### Web UI

- R12. Environment chips show deployment status when enriched data is present (e.g., build number, duration, success/fail indicator).
- R13. When deployment status is `in_progress`, show a scrolling/marquee animation beside the environment label on the chip.
- R14. UI updates in real time via existing WebSocket `monitor.updated` events (no new event types required).

### Acceptance Examples

- AE1. **Jenkins build in progress**
  - **Given:** A subtask has a `deployment` monitor with `env: dev`, Jenkins job URL, and build `2790`, and Jenkins returns `building: true`.
  - **When:** The scheduler runs the monitor.
  - **Then:** `lastResult.status` is `running`, `lastResult.metadata.deployment.status` is `in_progress`, subtask status becomes `IN_PROGRESS`, and the `dev` chip shows an in-progress animation.

- AE2. **Jenkins build succeeded**
  - **Given:** Jenkins returns `building: false`, `result: SUCCESS`, `duration: 2303459`.
  - **When:** The scheduler runs the monitor.
  - **Then:** `lastResult.status` is `success`, `metadata.deployment` includes `durationMs: 2303459` and `status: success`, and subtask status becomes `COMPLETED`.

- AE3. **Jenkins build failed**
  - **Given:** Jenkins returns `building: false`, `result: FAILURE`.
  - **When:** The scheduler runs the monitor.
  - **Then:** `lastResult.status` is `failed`, `metadata.deployment.status` is `fail`, and subtask status becomes `FAILED`.

### Scope Boundaries

**In scope:** Shared types, env validation, Jenkins deployment provider, DTO enrichment, MCP schema docs, web chip UI, unit tests, one integration test.

**Deferred to Follow-Up Work:**

- Auto-adding deployed environment chips when a deployment monitor succeeds (monitors and environments remain independently managed).
- Supporting CI systems other than Jenkins (future new monitor types via registry).
- Dedicated monitor status panel in the web UI beyond environment chip enrichment.

**Out of scope:** Storing deployment history beyond `monitor.lastResult`; Jenkins webhook push triggers; multi-build monitoring per subtask.

---

## Planning Contract

### Key Technical Decisions

| ID | Decision | Rationale |
|---|---|---|
| KTD-1 | Repurpose `MonitorType.DEPLOYMENT` | User confirmed; avoids enum proliferation while the generic HTTP stub has no production config to preserve. |
| KTD-2 | Structured `DeploymentInfo` in `lastResult.metadata.deployment` | Reuses existing `MonitorResult.metadata`; no new DB tables or migrations. |
| KTD-3 | Enrich `DeployedEnvironmentDto` at map time | UI already renders environment chips; joining monitor data in `toDeployedEnvironmentDto` / `toTodoDto` avoids a second API surface. |
| KTD-4 | `JENKINS_AUTH` env var (base64 `user:password`) | Matches `GITHUB_TOKEN` pattern; keeps secrets out of monitor config JSON stored in PostgreSQL. |
| KTD-5 | Parse `jobName` and `buildNumber` from config | Config stores `jobUrl` (full job path without build) + `buildNumber`, or a single `buildUrl`; provider normalizes to structured fields. |
| KTD-6 | Match enrichment by `config.env` ↔ `DeployedEnvironmentName` | Explicit link without schema migration on `DeployedEnvironment`. |

### High-Level Technical Design

```mermaid
sequenceDiagram
  participant Scheduler
  participant DeploymentProvider
  participant Jenkins
  participant DB as PostgreSQL
  participant WS as WebSocket
  participant Web as React Dashboard

  Scheduler->>DeploymentProvider: check(config)
  DeploymentProvider->>Jenkins: GET /job/.../build/api/json?tree=...
  Jenkins-->>DeploymentProvider: building, result, duration, url
  DeploymentProvider-->>Scheduler: MonitorResult + metadata.deployment
  Scheduler->>DB: update monitor.lastResult, subtask.status
  Scheduler->>WS: monitor.updated
  WS->>Web: invalidate / patch todos cache
  Note over Web: Env chip reads deployment from enriched DTO
```

**Jenkins URL construction:** `{jobUrl}/{buildNumber}/api/json?tree=building,result,duration,timestamp,url` where `jobUrl` is the Jenkins job base (e.g. `https://jenkins2.flodev.net/job/backend-nodejs-4-1.backend.dev.deploy`).

**Status mapping:**

| Jenkins | Platform `DeploymentInfo.status` | `MonitorResultStatus` |
|---|---|---|
| `building: true` | `in_progress` | `running` |
| `result: SUCCESS` | `success` | `success` |
| `result: FAILURE/ABORTED/UNSTABLE` | `fail` | `failed` |
| `result: null` (not building) | `in_progress` | `running` |

### Assumptions

- Jenkins instance is reachable from the backend container/process network.
- One active deployment monitor per subtask (existing 1:1 subtask-monitor constraint).
- `env` in monitor config uses API names (`dev`, `uat`, `uat-main`, `staging`) matching `DeployedEnvironmentName`.

### Sequencing

1. Shared types and config contract (U1)
2. Jenkins provider implementation (U2)
3. API DTO enrichment (U3)
4. MCP schema updates (U4)
5. Web UI chip enhancements (U5)

---

## Implementation Units

### U1. Shared deployment types and config contract

**Goal:** Define the cross-package deployment info model and replace `DeploymentMonitorConfig` with Jenkins-specific fields.

**Requirements:** R3, R6, R7

**Dependencies:** None

**Files:**
- `packages/shared-types/src/index.ts`
- `apps/backend/src/config/env.validation.ts`
- `README.md` (Monitor Providers section)

**Approach:**
- Add `DeploymentStatus` enum: `in_progress`, `success`, `fail`.
- Add `DeploymentInfo` interface: `env`, `jobName`, `buildNumber`, `durationMs`, `status`, optional `buildUrl`, `timestamp`.
- Replace `DeploymentMonitorConfig` with:
  - `env: DeployedEnvironmentName`
  - `jobUrl: string` (Jenkins job base URL, no trailing build segment)
  - `buildNumber: number`
- Extend `DeployedEnvironmentDto` with optional `deployment?: DeploymentInfo`.
- Add optional `JENKINS_AUTH` to `envSchema` (optional string).
- Update README deployment monitor example to Jenkins config shape.

**Patterns to follow:** `GitHubPrMonitorConfig`, `DeployedEnvironmentName` enums in `packages/shared-types/src/index.ts`.

**Test scenarios:**
- Test expectation: none — type-only change; behavior covered in U2 unit tests.

**Verification:** `packages/shared-types` builds; `DeploymentMonitorConfig` no longer references generic `url`/`deploymentId`.

---

### U2. Jenkins deployment monitor provider

**Goal:** Replace `DeploymentMonitorProvider` HTTP stub with Jenkins API polling and structured metadata.

**Requirements:** R1, R2, R4, R5, R6, R7

**Dependencies:** U1

**Files:**
- `apps/backend/src/monitors/providers/monitor-providers.ts`
- `apps/backend/src/monitors/providers/monitor-providers.spec.ts`
- `apps/backend/src/monitors/monitors.module.ts` (inject `ConfigService` if not already on provider)

**Approach:**
- Inject `ConfigService` into `DeploymentMonitorProvider` (mirror `GitHubPrMonitorProvider`).
- Validate config: `env`, `jobUrl`, `buildNumber` required.
- Build API URL: strip trailing slashes from `jobUrl`, append `/{buildNumber}/api/json?tree=building,result,duration,timestamp,url`.
- Set `Authorization: Basic ${JENKINS_AUTH}` when env var present; fail with clear message if missing.
- Parse Jenkins response; derive `jobName` from last segment of job URL path.
- Populate `metadata.deployment` as `DeploymentInfo` on every result path.
- Map to `MonitorResultStatus` per KTD table; human-readable `message` includes env and build number.

**Execution note:** Implement provider unit tests first with mocked `fetch` before wiring scheduler integration.

**Patterns to follow:** `GitHubPrMonitorProvider` for ConfigService + fetch + timeout; existing provider class structure in `monitor-providers.ts`.

**Test scenarios:**
- Missing `jobUrl` or `buildNumber` → `failed`, message names missing field.
- Missing `JENKINS_AUTH` → `failed`, message indicates auth not configured.
- Jenkins `building: true` → `running`, `deployment.status: in_progress`, `durationMs` from response when present.
- Jenkins `building: false`, `result: SUCCESS`, `duration: 2303459` → `success`, `deployment.durationMs: 2303459`.
- Covers AE2.
- Jenkins `result: FAILURE` → `failed`, `deployment.status: fail`. Covers AE3.
- Jenkins HTTP 404 → `failed` with API status in message.
- Network error → `failed` with error message.

**Verification:** `npm test --workspace=@todo-platform/backend -- --testPathPattern=monitor-providers` passes.

---

### U3. API DTO enrichment for deployed environments

**Goal:** Attach live deployment info to environment chips in todo/subtask API responses.

**Requirements:** R8, R9, R10

**Dependencies:** U1, U2

**Files:**
- `apps/backend/src/common/mappers.ts`
- `apps/backend/src/common/deployment-enrichment.ts` (new helper)
- `apps/backend/src/common/deployment-enrichment.spec.ts` (new)
- `apps/backend/src/todos/todos.service.ts` (ensure monitor included in queries if not already)
- `apps/backend/test/todos.integration-spec.ts`

**Approach:**
- Add `extractDeploymentInfo(lastResult): DeploymentInfo | undefined` reading `metadata.deployment`.
- Add `enrichDeployedEnvironments(environments, monitors): DeployedEnvironmentDto[]` that:
  - Accepts deployed environment rows and zero or more monitors (subtask monitor and/or subtask monitors for todo aggregation).
  - Matches `monitor.config.env` to `env.name` for `type === deployment` with enabled monitor.
  - For multiple monitors targeting same env, pick monitor with latest `lastRunAt`.
- Update `toSubtaskDto` to pass subtask's monitor into enrichment.
- Update `toTodoDto` to aggregate all subtask deployment monitors when enriching todo-level `deployedEnvironments`.
- Typed `lastResult` passthrough unchanged on `MonitorDto`.

**Patterns to follow:** `toDeployedEnvironmentDto`, `sortDeployedEnvironmentNames` in `apps/backend/src/common/deployed-environments.ts`.

**Test scenarios:**
- Subtask with `dev` env chip and matching deployment monitor → DTO `deployedEnvironments[0].deployment` populated.
- Todo with two subtasks monitoring different envs → todo-level chips show both deployments.
- Two subtasks, same env → chip shows deployment from monitor with newer `lastRunAt`.
- Monitor type `http` → no enrichment on env chips.
- Env chip with no matching monitor → `deployment` field absent.
- Integration: create subtask with deployment monitor config → GET todo returns monitor on subtask; enrichment unit tests cover chip attachment.

**Verification:** Unit tests pass; integration test for subtask + deployment monitor create succeeds.

---

### U4. MCP monitor config documentation

**Goal:** Document Jenkins deployment monitor config for MCP consumers creating subtasks.

**Requirements:** R11

**Dependencies:** U1

**Files:**
- `apps/mcp-server/src/index.ts`
- `README.md` (MCP tools section, if monitor examples exist)

**Approach:**
- In `create_subtask` and `update_subtask` tool schemas, expand the `monitor.config` description for `type: deployment` with an example JSON object (`env`, `jobUrl`, `buildNumber`).
- No new MCP tools required — existing monitor passthrough already forwards config to backend.

**Patterns to follow:** Existing `pullRequestSchema` / `deployedEnvironmentSchema` inline documentation style in `apps/mcp-server/src/index.ts`.

**Test scenarios:**
- Test expectation: none — schema-only documentation change.

**Verification:** MCP server builds; tool `inputSchema` includes deployment config example in description.

---

### U5. Web UI deployment status on environment chips

**Goal:** Show deployment details and in-progress animation on environment chips.

**Requirements:** R12, R13, R14

**Dependencies:** U3

**Files:**
- `apps/web/src/components/DeployedEnvironmentList.tsx`
- `apps/web/src/index.css`

**Approach:**
- Extend chip rendering: when `env.deployment` present, show compact secondary text (e.g. `#2790`, formatted duration, status icon/color).
- Add CSS class `env-chip-deploying` with marquee/scrolling animation on the env label when `deployment.status === in_progress`.
- Add status modifiers: `env-chip-deploy-success`, `env-chip-deploy-fail` for quick visual scan.
- Tooltip/title includes job name, build URL, full duration.
- WebSocket handler already patches `monitor` on `monitor.updated`; ensure todos refetch or patch includes enriched `deployedEnvironments` — if WS payload lacks enrichment, invalidate `['todos']` query on `monitor.updated` (minimal change in `useWebSocket.ts`).

**Patterns to follow:** Existing `env-chip-*` color classes; `PullRequestList` compact secondary metadata pattern.

**Test scenarios:**
- Test expectation: none — visual/UI change; manual verification per verification contract.

**Verification:** With backend running, a todo showing `dev` chip and in-progress deployment displays animation; success/fail states show distinct styling.

---

## Verification Contract

| Gate | Command / action | Applies to |
|---|---|---|
| Shared types build | `npm run build --workspace=@todo-platform/shared-types` | U1 |
| Backend unit tests | `npm test --workspace=@todo-platform/backend` | U2, U3 |
| Backend integration tests | `DATABASE_URL=postgresql://todo:todo@localhost:5432/todo_platform REDIS_URL=redis://localhost:6379 npm run test:integration --workspace=@todo-platform/backend` | U3 |
| Web build | `npm run build --workspace=@todo-platform/web` | U5 |
| Manual smoke | Create subtask with deployment monitor via API; confirm env chip shows status in web UI at `http://localhost:5173` | U5 |

---

## Definition of Done

- [ ] `DeploymentMonitorProvider` polls Jenkins and returns structured `DeploymentInfo` in metadata (R4–R6).
- [ ] `DeployedEnvironmentDto` carries optional `deployment` enriched from monitors (R9–R10).
- [ ] MCP schemas document Jenkins deployment config (R11).
- [ ] Environment chips show status and in-progress animation (R12–R13).
- [ ] All verification contract gates pass.
- [ ] No dead experimental code from implementation attempts removed before done.
- [ ] README monitor section reflects Jenkins deployment config (replaces generic HTTP example).

---

## System-Wide Impact

| Surface | Impact |
|---|---|
| Backend scheduler | Existing cron execution path unchanged; only provider behavior changes. |
| PostgreSQL | No migration; `monitor.config` JSON shape changes for `deployment` type. |
| MCP clients | Must use new deployment config fields (`env`, `jobUrl`, `buildNumber`). |
| Web dashboard | Environment chips become dynamic; WS may trigger todos refetch. |
| Docker / ops | Add optional `JENKINS_AUTH` to backend environment. |

---

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| Breaking change for any existing `deployment` monitor using old `url` config | Document in README; no production configs found in repo. Acceptable per user scope choice. |
| Jenkins unreachable from backend network | Provider returns `failed` with message; subtask moves to `FAILED`. |
| Missing `JENKINS_AUTH` in environment | Provider fails fast with actionable message; document in README env table. |
| WS cache patch may not include enriched todo-level envs | Invalidate todos query on `monitor.updated` if patch proves insufficient. |

---

## Sources & Research

- Origin: `docs/requirements/jenkin_deploy_monitor.md`
- Existing monitor plugin pattern: `apps/backend/src/monitors/providers/monitor-provider.registry.ts`, `README.md` Monitor Providers section
- Jenkins build API sample: origin doc cURL (`building`, `result`, `duration`, `timestamp`, `url`)
- Deployed environments: `apps/backend/src/common/deployed-environments.ts`, `apps/web/src/components/DeployedEnvironmentList.tsx`
