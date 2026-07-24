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

| `environment` | `list_todos.status` | PR gate |
|---------------|---------------------|---------|
| `dev` | `IN_PROGRESS` | dev-based (`baseRefName === "dev"`) |
| `uat` | `IN_PROGRESS` | none |
| `uat-main` | `TESTING` | all associated PRs on matching todos |

Wire values: `TodoStatus.IN_PROGRESS` → `"IN_PROGRESS"`, `TodoStatus.TESTING` → `"TESTING"`.

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

## Jenkins: trigger build

TodoX deployment monitors **poll** builds; they do not trigger them. This skill triggers builds via Jenkins REST API, mirroring how operators start deploy jobs manually.

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

### Resolve build number (poll every 30 seconds)

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

## GitHub: PR merge gates

Parse PR URLs like `https://github.com/my-org/my-repo/pull/123`:

- `owner` = `my-org`
- `repo` = `my-repo`
- `number` = `123`

Check merge state:

```bash
gh pr view 123 --repo my-org/my-repo \
  --json merged,state,baseRefName,title,url
```

| Flow | PR filter | Gate |
|------|-----------|------|
| `dev` | `baseRefName == "dev"` | all such PRs on affected todos must have `"merged": true` |
| `uat-main` | none (check every `todo.pullRequests[]` entry) | all associated PRs on affected todos must have `"merged": true` |
| `uat` | — | no PR gate |

If any gated PR has `merged: false`, stop and list open PRs (number, title, URL).

## uat-main: confirm todos before deploy

After all PRs pass for `uat-main`, **pause before Jenkins or MCP deploy updates**.

1. Show every candidate todo (from `list_todos` union across input services) in a numbered table or list with: index, `id`, `title`, `service.keyName`, `status`, merged PR numbers.
2. Ask the user which todos to deploy. Valid replies:
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

Backend scheduler uses standard 5-field cron (`cron-parser`); the skill's **30-second** interval applies only while the agent polls Jenkins for new build numbers after trigger.

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
