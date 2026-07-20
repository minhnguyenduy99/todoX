I want to support monitoring the deployment status of a todo item. the deployment is on jenkins

Requirements:
- we already have monitoring system. we just extend the type of monitor that we want to support. make sure that the implemented code should be extendable in the future for other monitoring task type
- the deployment info should have following properties: env (dev, uat, uat-main, staging), job name, build number, duration (in ms), status (in progress, success, fail)
- use jenkins API to fetch deployment info. sample cURL:
```
curl --location 'https://jenkins2.flodev.net/job/backend-nodejs-4-1.backend.dev.deploy/2790/api/json?tree=building%2Cresult%2Cduration%2Ctimestamp%2Curl' \
--header 'Authorization: Basic bWluaG5kOTk6MTFhMzgyNjM4NDJjMTI2MjBiMTZkYmFhMWVjZDA4MDdkYg=='
```
the sample response body is:
```
{
    "_class": "org.jenkinsci.plugins.workflow.job.WorkflowRun",
    "building": false,
    "duration": 2303459,
    "result": "SUCCESS",
    "timestamp": 1784521296700,
    "url": "https://jenkins2.flodev.net/job/backend-nodejs-4-1.backend.dev.deploy/2790/"
}
```
make sure to research and map values properly
- check if we need to update backend api or mcp server to return the full deployment info
- for the web ui, since we already displayed the deployed environment, display more info of the deployment. for example: we can add a scrolling effect beside the environmen text to indicate that the it is being deployed
