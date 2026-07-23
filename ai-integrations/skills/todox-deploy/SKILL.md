---
name: todox-deploy
description: >-
  Deploy TodoX catalog services to dev, uat, or uat-main via Jenkins, validate
  services, gate on merged dev/main PRs, and attach deployment monitors to
  matching todos. Use when the user asks to deploy services to dev/uat/uat-main,
  run todox-deploy, or trigger Jenkins deploys for TodoX todos.
argument-hint: "[environment: dev|uat|uat-main] [service-key-names...]"
disable-model-invocation: true
---

# TodoX Deploy

Deploy one or more catalog services to **dev**, **uat**, or **uat-main**, then update matching todos with deployed-environment chips and Jenkins deployment monitors.

## Arguments

| Argument | Required | Values |
|----------|----------|--------|
| `environment` | yes | `dev`, `uat`, or `uat-main` |
| `services` | yes | One or more service `keyName` slugs (e.g. `billing-api`, `auth`) |

Example invocations:

- `/todox-deploy dev billing-api auth`
- `/todox-deploy uat flo-api`
- `/todox-deploy uat-main billing-api`

## Prerequisites

1. **TodoX MCP** (`todo-platform`) is connected — see `.cursor/mcp.json` and README MCP section.
2. **`JENKINS_AUTH`** is set in the environment (base64 `user:password`, same as TodoX backend deployment monitors).
3. **`gh` CLI** is authenticated for PR merge checks (**dev** and **uat-main** flows).
4. Each target service has a **catalog deployment** row for the requested environment (`service.deployments[]` with matching `environment` and `jobUrl`). Configure these on the TodoX Services page when available.

Discover MCP tools with `GetMcpTools` for server `todo-platform` before calling them.

## Flow

Execute steps in order. **Stop immediately** on any validation or gate failure and report what blocked progress.

### 1. Validate services

1. Call MCP `list_services`.
2. Build the set of valid `keyName` values from the response.
3. For each input service, confirm it exists in that set.
4. **If any service is invalid:** stop and tell the user which names are unknown and which `keyName` values are available.

### 2. Resolve deployment job URLs

For each validated service:

1. Resolve its service record from the `list_services` result (capture `id` and `keyName`).
2. Call MCP `get_service` with that `id`.
3. Find `deployments[]` entry where `environment` equals the input `environment`.
4. Read `jobUrl` (Jenkins job base URL, no build number).
5. **If any service lacks a deployment for this environment:** stop and tell the user to configure the catalog deployment first.

Do **not** trigger Jenkins yet — deployment happens in step 4 after todo/PR gates.

### 3. Identify todos and apply environment gates

Per-environment todo selection:

| `environment` | `list_todos` status | PR merge gate |
|-----------------|---------------------|---------------|
| `dev` | `IN_PROGRESS` | dev-based PRs (`baseRefName === "dev"`) |
| `uat` | `IN_PROGRESS` | none |
| `uat-main` | `TESTING` | main-based PRs (`baseRefName === "main"`) |

For **each** input service, call MCP `list_todos` with:

- `status`: from the table above
- `serviceKeyName`: the service `keyName`

Collect the union of matching todos (dedupe by todo `id`). Keep a map of which services each todo belongs to via its `service.keyName`.

#### 3.1 When `environment` is `dev`

**3.1.1** — Todos are already listed above (`IN_PROGRESS`).

**3.1.2** — For every associated pull request on those todos (`todo.pullRequests[]`), treat a PR as **dev-based** when GitHub reports `baseRefName === "dev"`.

For each dev-based PR:

1. Parse `owner`, `repo`, and PR number from `pullRequest.url` (GitHub `…/owner/repo/pull/N`).
2. Verify merge state with the real GitHub API via `gh` (do not trust stored `pullRequest.status` alone):

```bash
gh pr view <number> --repo <owner>/<repo> --json merged,state,baseRefName,title,url
```

3. **If any dev-based PR has `merged: false`:** stop and tell the user to merge those PRs first. Include PR number, title, and URL in the message.
4. **When all dev-based PRs for the affected todos are merged:** refresh stored PR status on each todo via MCP `update_todo` (or `add_associated_pull_request` per PR) so `pullRequest.status` is `merged` and matches `gh` output.

#### 3.2 When `environment` is `uat`

**3.2.1** — Todos are already listed above (`IN_PROGRESS`). No PR merge gate for UAT in this skill.

#### 3.3 When `environment` is `uat-main`

**3.3.1** — Todos are already listed above (`TESTING`).

**3.3.2** — Same flow as **dev** (step 3.1.2), but treat a PR as **main-based** when GitHub reports `baseRefName === "main"`.

For each main-based PR:

1. Parse `owner`, `repo`, and PR number from `pullRequest.url`.
2. Verify merge state via `gh` (same command as dev).
3. **If any main-based PR has `merged: false`:** stop and tell the user to merge those PRs first.
4. **When all main-based PRs for the affected todos are merged:** refresh stored PR status on each todo via MCP `update_todo` (or `add_associated_pull_request` per PR).

### 4. Deploy services and update todos

Deploy **all** input services, then attach deployment state to the todos identified in step 3.

#### 4.1 Trigger Jenkins builds

For each service `jobUrl`, trigger a new build using the Jenkins REST API (see [reference.md](reference.md)):

1. `POST {jobUrl}/build` with `Authorization: Basic ${JENKINS_AUTH}`.
2. Poll every **30 seconds** until the new build is observable:

```http
GET {jobUrl}/api/json?tree=lastBuild[number,url,building,result]
Authorization: Basic ${JENKINS_AUTH}
```

3. Capture `buildNumber` and full build URL (`lastBuild.url`) for each service.
4. If a build does not appear within a reasonable window (e.g. 10 minutes), stop and report which service failed.

Trigger all services before updating todos. Reuse the same polling interval (**30 seconds**) between status checks.

#### 4.2 Update deployed environment + deployment monitor

For each todo identified in step 3 that belongs to a deployed service:

1. Call MCP `add_deployed_environment` with `todoId` and `environment` (the input env).
2. Call MCP `update_todo` to attach or replace the todo-level deployment monitor:

```json
{
  "id": "<todoId>",
  "monitor": {
    "type": "deployment",
    "cron": "*/1 * * * *",
    "config": {
      "env": "<environment>",
      "jobUrl": "<normalized job base url>",
      "buildNumber": <buildNumber>
    }
  }
}
```

Use the **normalized job base URL** (no trailing slash, no build segment) and the **build number** from step 4.1. The platform polls Jenkins on the monitor cron schedule; the **30-second interval** in this skill applies to Jenkins polling while resolving build numbers after trigger (step 4.1), not the backend scheduler cadence (minimum practical cron: one minute).

If a todo already has a deployment monitor, `update_todo` replaces it (one monitor per todo).

## Completion report

When finished, summarize:

- Environment and services deployed
- Jenkins build number and build URL per service
- Todos updated (id, title, service, status filter used)
- PRs verified merged (dev or uat-main only)
- Any todos skipped and why

## Stop conditions (fail closed)

| Condition | Action |
|-----------|--------|
| Unknown service `keyName` | Stop at step 1 |
| Missing catalog `jobUrl` for environment | Stop at step 2 |
| Dev PR with `baseRefName=dev` not merged | Stop at step 3.1.2 |
| Main PR with `baseRefName=main` not merged | Stop at step 3.3.2 |
| Jenkins trigger or build resolution failure | Stop at step 4.1 |
| MCP / `gh` / Jenkins auth errors | Stop and report the failing command |

## Examples

**Deploy two services to dev after PRs are merged**

```
/todox-deploy dev billing-api auth
```

Expected: validate → resolve job URLs → list `IN_PROGRESS` todos → verify dev-base PRs via `gh` → trigger Jenkins → attach `dev` env chips + deployment monitors.

**Deploy one service to uat**

```
/todox-deploy uat flo-api
```

Expected: validate → resolve job URL → list `IN_PROGRESS` todos for `flo-api` → trigger Jenkins → attach monitors (no PR gate).

**Deploy to uat-main after main PRs are merged**

```
/todox-deploy uat-main billing-api
```

Expected: validate → resolve job URLs → list `TESTING` todos → verify main-base PRs via `gh` → trigger Jenkins → attach `uat-main` env chips + deployment monitors.
