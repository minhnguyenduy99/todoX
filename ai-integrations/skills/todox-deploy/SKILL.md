---
name: todox-deploy
description: >-
  Deploy TodoX catalog services to dev, uat, or uat-main via Jenkins, validate
  services, gate on merged dev PRs or main-based PRs for uat-main, confirm uat-main
  todo selection with the user, then attach deployment monitors to chosen todos.
  For uat-main, DevOps auto-triggers Jenkins after main PR merge — discover the
  running build instead of starting a new one.
  Use when the user asks to deploy services to dev/uat/uat-main, run todox-deploy,
  or trigger Jenkins deploys for TodoX todos.
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

Do **not** call Jenkins yet — build resolution happens in step 4 after todo/PR gates.

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

DevOps **automatically triggers** the uat-main Jenkins job when a **main-based PR is merged**. This skill **does not** start a new Jenkins build for `uat-main` — it discovers the build DevOps already started.

**3.3.1** — Todos are already listed above (`TESTING`).

**3.3.2** — For every associated pull request on those todos (`todo.pullRequests[]`), treat a PR as **main-based** when GitHub reports `baseRefName === "main"`.

For each main-based PR:

1. Parse `owner`, `repo`, and PR number from `pullRequest.url` (GitHub `…/owner/repo/pull/N`).
2. Verify merge state with the real GitHub API via `gh` (do not trust stored `pullRequest.status` alone):

```bash
gh pr view <number> --repo <owner>/<repo> --json merged,state,baseRefName,title,url
```

3. **If any main-based PR has `merged: false`:** stop and tell the user to merge those PRs first. Include PR number, title, and URL in the message. Remind them that uat-main deploy starts automatically after merge — do not merge until they are ready for that service to deploy.
4. **When all main-based PRs for the affected todos are merged:** refresh stored PR status on each todo via MCP `update_todo` (or `add_associated_pull_request` per PR) so `pullRequest.status` is `merged` and matches `gh` output.

Todos with **no** main-based PR in `pullRequests[]` cannot proceed on the uat-main path — stop and ask the user to associate the main PR first.

**3.3.3 — Confirm todo selection before attach (required for `uat-main` only)**

After step 3.3.2 passes, **stop and do not resolve Jenkins builds or attach monitors yet**.

1. Print a numbered list of every candidate todo from step 3 (deduped union), including at minimum:
   - `#` (1-based index)
   - todo `id`
   - `title`
   - `service.keyName`
   - current `status`
   - main-based PR numbers (and whether each is merged)
2. Ask the user which todos to include in this uat-main deploy. Accept:
   - **All** — attach monitors for every listed todo
   - **Subset** — todo ids, titles, or list indices (e.g. `1,3` or `todo-uuid-a,todo-uuid-b`)
   - **None / cancel** — abort without attaching monitors
3. Resolve the user's reply into a **selected todo set**. If the reply is ambiguous, ask a short follow-up; do not guess.
4. **If the selected set is empty:** stop and report that deploy was cancelled.
5. **If the selected set is non-empty:** restrict all of step 4 to **only those todos**. Do not attach uat-main monitors or env chips to unselected todos.

For `dev` and `uat`, skip this confirmation step and proceed with all todos from step 3.

### 4. Resolve Jenkins builds and update todos

Resolve a build for **all** input services, then attach deployment state to the todos selected for deploy (all todos from step 3 for `dev`/`uat`; user-confirmed subset for `uat-main`).

#### 4.1 Resolve Jenkins build numbers

**For `dev` and `uat` — trigger a new build**

For each service `jobUrl`, trigger a new build using the Jenkins REST API (see [reference.md](reference.md)):

1. `POST {jobUrl}/build` with `Authorization: Basic ${JENKINS_AUTH}`.
2. Poll every **30 seconds** until the new build is observable:

```http
GET {jobUrl}/api/json?tree=lastBuild[number,url,building,result]
Authorization: Basic ${JENKINS_AUTH}
```

3. Capture `buildNumber` and full build URL (`lastBuild.url`) for each service.
4. If a build does not appear within a reasonable window (e.g. 10 minutes), stop and report which service failed.

**For `uat-main` — discover DevOps auto-triggered build (do not POST /build)**

DevOps starts the uat-main job when the main PR merges. Discover that build instead of triggering a duplicate:

1. Before waiting, record the current `lastBuild.number` (baseline) for each service `jobUrl`.
2. Poll every **30 seconds**:

```http
GET {jobUrl}/api/json?tree=lastBuild[number,url,building,result,timestamp]
Authorization: Basic ${JENKINS_AUTH}
```

3. Accept a build when **either**:
   - `lastBuild.building === true` — use that running build immediately, **or**
   - `lastBuild.number` is greater than the baseline — DevOps started a new build (use even if it already finished).
4. Capture `buildNumber` and `lastBuild.url` for each service.
5. If no new or running build appears within a reasonable window (e.g. **15 minutes** after PR merge verification), stop and report which service has no observable auto-deploy. Suggest the user confirm DevOps pipeline ran or retry after the job starts.

Resolve all services before updating todos. Reuse the same **30-second** polling interval between checks.

#### 4.2 Update deployed environment + deployment monitor

For each todo in the deploy set (step 3 for `dev`/`uat`; step 3.3.3 selection for `uat-main`) that belongs to a deployed service:

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

Use the **normalized job base URL** (no trailing slash, no build segment) and the **build number** from step 4.1. The platform polls Jenkins on the monitor cron schedule; the **30-second interval** in this skill applies to Jenkins polling while resolving build numbers (step 4.1), not the backend scheduler cadence (minimum practical cron: one minute).

If a todo already has a deployment monitor, `update_todo` replaces it (one monitor per todo).

## Completion report

When finished, summarize:

- Environment and services deployed
- Jenkins build number and build URL per service
- For `uat-main`: note builds were **discovered** (auto-triggered by DevOps), not manually triggered
- Todos updated (id, title, service, status filter used)
- For `uat-main`: todos offered vs todos the user selected
- PRs verified merged (dev-based PRs for `dev`; main-based PRs for `uat-main`)
- Any todos skipped and why

## Stop conditions (fail closed)

| Condition | Action |
|-----------|--------|
| Unknown service `keyName` | Stop at step 1 |
| Missing catalog `jobUrl` for environment | Stop at step 2 |
| Dev PR with `baseRefName=dev` not merged | Stop at step 3.1.2 |
| Main-based PR on uat-main todos not merged | Stop at step 3.3.2 |
| uat-main todo has no main-based PR associated | Stop at step 3.3.2 |
| User cancels uat-main todo selection or selects none | Stop at step 3.3.3 |
| Ambiguous uat-main selection | Ask follow-up at step 3.3.3; do not attach monitors until resolved |
| Jenkins trigger failure (`dev` / `uat`) | Stop at step 4.1 |
| No auto-triggered uat-main build observed | Stop at step 4.1 |
| MCP / `gh` / Jenkins auth errors | Stop and report the failing command |

## Examples

**Deploy two services to dev after PRs are merged**

```
/todox-deploy dev billing-api auth
```

Expected: validate → resolve job URLs → list `IN_PROGRESS` todos → verify dev-base PRs via `gh` → **trigger Jenkins** → attach `dev` env chips + deployment monitors.

**Deploy one service to uat**

```
/todox-deploy uat flo-api
```

Expected: validate → resolve job URL → list `IN_PROGRESS` todos for `flo-api` → **trigger Jenkins** → attach monitors (no PR gate).

**Attach uat-main monitors after main PR merge (auto-deploy)**

```
/todox-deploy uat-main billing-api
```

Expected: validate → resolve job URLs → list `TESTING` todos → verify main-based PRs merged via `gh` → **print todo list and wait for user selection** → **discover running/latest auto-triggered Jenkins build** (no POST /build) → attach `uat-main` env chips + deployment monitors **only to selected todos**.
