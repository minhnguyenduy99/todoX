# TodoX Deploy — Reference

## MCP tools used

| Tool | Purpose |
|------|---------|
| `list_services` | Validate service `keyName` values |
| `get_service` | Read `deployments[]` catalog (`environment`, `jobUrl`) |
| `list_todos` | Find todos by status + `serviceKeyName` |
| `update_todo` | Refresh PR status; attach deployment monitor |
| `add_associated_pull_request` | Alternative for single PR status refresh |
| `add_deployed_environment` | Record env chip on todo |

Call `GetMcpTools` with server `todo-platform` before invoking tools.

## Environment-specific todo filters

| `environment` | `list_todos.status` | PR gate | Jenkins action |
|---------------|---------------------|---------|----------------|
| `dev` | `IN_PROGRESS` | dev-based (`baseRefName === "dev"`) | **Trigger** new build (`POST /build`) |
| `uat` | `IN_PROGRESS` | none | **Trigger** new build |
| `uat-main` | `TESTING` | main-based (`baseRefName === "main"`) | **Discover** auto-triggered build (no POST) |

Wire values: `TodoStatus.IN_PROGRESS` → `"IN_PROGRESS"`, `TodoStatus.TESTING` → `"TESTING"`.

### uat-main auto-deploy model

When a **main-based PR is merged**, DevOps automatically starts the uat-main Jenkins job for the corresponding service. The agent must **not** call `POST /build` for `uat-main` — that would duplicate work and can race the pipeline DevOps already started.

Instead:

1. Verify the main PR is merged (step 3.3.2).
2. Poll the service's uat-main `jobUrl` until a **running** build or a **new** build (number > baseline) appears.
3. Attach the TodoX deployment monitor to that build number.

## Service deployment catalog

Each `ServiceDto` may include:

```json
{
  "id": "…",
  "keyName": "billing-api",
  "displayName": "Billing API",
  "deployments": [
    {
      "id": "…",
      "environment": "dev",
      "jobUrl": "https://jenkins.example.net/job/billing-api.dev.deploy"
    },
    {
      "id": "…",
      "environment": "uat-main",
      "jobUrl": "https://jenkins.example.net/job/billing-api.uat-main.deploy"
    }
  ]
}
```

Match `environment` to the skill input (`dev`, `uat`, or `uat-main`). Use `jobUrl` as the Jenkins job base (same normalization as TodoX backend: trim trailing slash, strip trailing `/\d+` build segment if present).

## Jenkins: trigger build (`dev` and `uat` only)

TodoX deployment monitors **poll** builds; they do not trigger them. For **dev** and **uat**, this skill triggers builds via Jenkins REST API, mirroring how operators start deploy jobs manually.

**Do not use this section for `uat-main`.** See [Jenkins: discover uat-main build](#jenkins-discover-uat-main-build) instead.

### Authentication

```bash
# JENKINS_AUTH is already base64(user:password)
curl -sS -X POST "${JOB_URL}/build" \
  -H "Authorization: Basic ${JENKINS_AUTH}"
```

Some Jenkins instances require a CSRF crumb:

```bash
CRUMB=$(curl -sS "${JENKINS_BASE}/crumbIssuer/api/json" \
  -H "Authorization: Basic ${JENKINS_AUTH}" | jq -r '.crumb')
CRUMB_FIELD=$(curl -sS "${JENKINS_BASE}/crumbIssuer/api/json" \
  -H "Authorization: Basic ${JENKINS_AUTH}" | jq -r '.crumbRequestField')

curl -sS -X POST "${JOB_URL}/build" \
  -H "Authorization: Basic ${JENKINS_AUTH}" \
  -H "${CRUMB_FIELD}: ${CRUMB}"
```

If `POST` returns `403` or `405`, retry with crumb or `buildWithParameters` when the job requires parameters.

### Resolve build number after trigger (poll every 30 seconds)

Before trigger, note the current last build number (if any):

```bash
curl -sS "${JOB_URL}/api/json?tree=lastBuild[number,building]" \
  -H "Authorization: Basic ${JENKINS_AUTH}"
```

After `POST /build`, poll until `lastBuild.number` increases and/or `lastBuild.building` is true:

```bash
curl -sS "${JOB_URL}/api/json?tree=lastBuild[number,url,building,result,timestamp]" \
  -H "Authorization: Basic ${JENKINS_AUTH}"
```

Wait **30 seconds** between polls. Map fields the same way as `DeploymentMonitorProvider` in `apps/backend/src/monitors/providers/monitor-providers.ts`:

| Jenkins field | Monitor meaning |
|---------------|-----------------|
| `building: true` | in progress |
| `result: SUCCESS` | success |
| `FAILURE` / `ABORTED` / `UNSTABLE` | failed |

Build poll URL for an existing build (what the monitor uses):

```http
GET {jobUrl}/{buildNumber}/api/json?tree=building,result,duration,timestamp,url
Authorization: Basic ${JENKINS_AUTH}
```

## Jenkins: discover uat-main build

For **uat-main only** — DevOps auto-triggers the job when the main PR merges. Discover that build; never `POST /build`.

### 1. Baseline

```bash
curl -sS "${JOB_URL}/api/json?tree=lastBuild[number,building,timestamp]" \
  -H "Authorization: Basic ${JENKINS_AUTH}"
```

Record `BASELINE_NUMBER=lastBuild.number` (or `0` if `lastBuild` is null).

### 2. Poll until auto-deploy is observable (every 30 seconds)

```bash
curl -sS "${JOB_URL}/api/json?tree=lastBuild[number,url,building,result,timestamp]" \
  -H "Authorization: Basic ${JENKINS_AUTH}"
```

Accept when **either**:

| Condition | Meaning |
|-----------|---------|
| `lastBuild.building === true` | DevOps job is running — use this build immediately |
| `lastBuild.number > BASELINE_NUMBER` | New build started after merge — use even if already finished |

Capture `buildNumber = lastBuild.number` and build URL `lastBuild.url`.

### 3. Timeout

If neither condition is met within **15 minutes**, stop and report. Common causes:

- Main PR merged but DevOps pipeline has not started yet (retry later)
- Wrong `jobUrl` in service catalog
- Jenkins auth failure (`403`)

### 4. Optional sanity check

If `lastBuild.timestamp` is available, confirm it is **after** the main PR merge time from `gh pr view … --json mergedAt`. If the build is clearly older than the merge, keep polling for a newer build (`number > BASELINE_NUMBER`).

Backend helper (same API shape): `fetchJenkinsJobLastBuild` in `apps/backend/src/jenkins/jenkins-last-build.ts`.

## GitHub: PR merge gates

Parse PR URLs like `https://github.com/my-org/my-repo/pull/123`:

- `owner` = `my-org`
- `repo` = `my-repo`
- `number` = `123`

Check merge state:

```bash
gh pr view 123 --repo my-org/my-repo \
  --json merged,state,baseRefName,title,url,mergedAt
```

| Flow | PR filter | Gate |
|------|-----------|------|
| `dev` | `baseRefName == "dev"` | all such PRs on affected todos must have `"merged": true` |
| `uat-main` | `baseRefName == "main"` | all main-based PRs on affected todos must have `"merged": true` |
| `uat` | — | no PR gate |

If any gated PR has `merged: false`, stop and list open PRs (number, title, URL).

For `uat-main`, todos must have at least one associated PR targeting `main`. Other PRs (e.g. dev-only) are ignored for the merge gate but may remain on the todo.

## uat-main: confirm todos before attach

After all main-based PRs pass for `uat-main`, **pause before Jenkins discovery or MCP monitor attach**.

1. Show every candidate todo (from `list_todos` union across input services) in a numbered table or list with: index, `id`, `title`, `service.keyName`, `status`, main-based PR numbers.
2. Ask the user which todos to attach. Valid replies:
   - `all` — every candidate
   - subset by 1-based index (`1,3`), todo id, or title
   - cancel / none — abort
3. Step 4 (`add_deployed_environment`, `update_todo` monitor) runs **only for the selected todos**. Unselected todos must not receive uat-main env chips or deployment monitors in this run.

This prevents every `TESTING` todo on a service from receiving the same Jenkins build monitor and auto-transitioning to `WAIT_FOR_STAGING` when the user only intended one todo.

**Update TodoX PR status** after verification:

```json
{
  "id": "<todoId>",
  "pullRequest": {
    "number": 123,
    "title": "<from gh>",
    "status": "merged",
    "url": "<from gh>"
  }
}
```

Or pass the full `pullRequests` array via `update_todo` when updating multiple PRs at once.

## Deployment monitor shape

From TodoX README and MCP `deploymentMonitorConfigDescription`:

```json
{
  "type": "deployment",
  "cron": "*/1 * * * *",
  "config": {
    "env": "uat-main",
    "jobUrl": "https://jenkins.example.net/job/my-service.uat-main.deploy",
    "buildNumber": 2790
  }
}
```

Allowed `env` values on todos: `dev`, `uat`, `uat-main`, `staging`.

Backend scheduler uses standard 5-field cron (`cron-parser`); the skill's **30-second** interval applies only while the agent polls Jenkins during build resolution (step 4.1), not the backend scheduler cadence (minimum practical cron: one minute).

## list_todos examples

**dev / uat:**

```json
{
  "status": "IN_PROGRESS",
  "serviceKeyName": "billing-api"
}
```

**uat-main:**

```json
{
  "status": "TESTING",
  "serviceKeyName": "billing-api"
}
```
