#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TodoApiClient } from '@todo-platform/shared-api';
import {
  MonitorType,
  ReleaseType,
  SubtaskStatus,
  TodoStatus,
  TestcaseScanStatus,
  type CreateReleaseDto,
  type CreateSubtaskDto,
  type CreateTodoDto,
  type UpdateReleaseDto,
  type UpdateSubtaskDto,
  type UpdateTodoDto,
} from '@todo-platform/shared-types';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { randomUUID } from 'node:crypto';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { validateMcpEnv } from './config.js';
import {
  addAssociatedPullRequest,
  pullRequestSchema,
  resolveCreatePullRequests,
  resolveUpdatePullRequests,
} from './pull-requests.js';
import {
  addDeployedEnvironment,
  deployedEnvironmentSchema,
  resolveCreateDeployedEnvironments,
  resolveUpdateDeployedEnvironments,
} from './deployed-environments.js';
import {
  addAssociatedTicket,
  associatedTicketSchema,
  resolveCreateAssociatedTickets,
  resolveUpdateAssociatedTickets,
  addAssociatedTicketDescription,
} from './associated-ticket.js';
import {
  createServiceSchema,
  serviceIdParamSchema,
  todoServiceFields,
  updateServiceSchema,
} from './services.js';
import {
  createReleaseSchema,
  listTodosFilterSchema,
  releaseIdParamSchema,
  updateReleaseSchema,
} from './releases.js';

const deploymentMonitorConfigDescription =
  'Monitor-specific configuration. For type deployment (Jenkins): { "env": "dev"|"uat"|"uat-main"|"staging", "jobUrl": "https://jenkins.example.net/job/my-job", "buildNumber": 2790 }';

const testcaseScanSchema = {
  type: 'object' as const,
  properties: {
    name: { type: 'string', description: 'Scan name or label' },
    status: {
      type: 'string',
      enum: Object.values(TestcaseScanStatus),
      description: 'Optional when jobUrl is provided (defaults to scanning)',
    },
    jobUrl: {
      type: 'string',
      description:
        'Optional Jenkins build URL (e.g. https://jenkins-scan.example.net/job/test/42). When set, a scan monitor is scheduled.',
    },
  },
  required: ['name'],
};

const monitorInputSchema = {
  type: 'object' as const,
  description:
    'Optional monitor configuration. Deployment monitors upsert by config.env — attaching uat does not replace an existing dev monitor.',
  properties: {
    type: { type: 'string', enum: Object.values(MonitorType) },
    cron: {
      type: 'string',
      description: 'Cron expression e.g. */5 * * * *',
    },
    enabled: { type: 'boolean' },
    config: {
      type: 'object',
      description: deploymentMonitorConfigDescription,
    },
  },
  required: ['type', 'cron', 'config'],
};

const env = validateMcpEnv();
const api = new TodoApiClient({ baseUrl: env.BACKEND_URL });

const tools = [
  {
    name: 'create_todo',
    description: 'Create a new todo item',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Todo title' },
        description: { type: 'string', description: 'Optional description' },
        changelog: {
          type: 'string',
          description: 'Optional release-note text for this todo',
        },
        status: {
          type: 'string',
          enum: Object.values(TodoStatus),
          description: 'Todo status',
        },
        pullRequests: {
          type: 'array',
          description:
            'Associated pull requests (full list; prefer pullRequest to add one)',
          items: pullRequestSchema,
        },
        pullRequest: {
          ...pullRequestSchema,
          description:
            'Associate a single pull request (use this instead of pullRequests when adding one PR)',
        },
        deployedEnvironments: {
          type: 'array',
          description:
            'Deployed environments (full list; prefer deployedEnvironment to add one)',
          items: deployedEnvironmentSchema,
        },
        deployedEnvironment: {
          ...deployedEnvironmentSchema,
          description:
            'Mark a single deployed environment (use this instead of deployedEnvironments when adding one)',
        },
        associatedTicket: {
          ...associatedTicketSchema,
          description:
            'Associate a single external ticket (use this instead of associatedTickets when adding one ticket)',
        },
        associatedTickets: {
          type: 'array',
          description:
            'Associated external tickets (full list; prefer associatedTicket to add one)',
          items: associatedTicketSchema,
        },
        serviceId: todoServiceFields.serviceId,
        serviceKeyName: todoServiceFields.serviceKeyName,
        monitor: monitorInputSchema,
        testcaseScanHistory: {
          type: 'array',
          description: 'Initial testcase scan history records',
          items: testcaseScanSchema,
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_todos',
    description:
      'List todos with optional filters for release eligibility (status, service, availableForRelease)',
    inputSchema: listTodosFilterSchema,
  },
  {
    name: 'get_todo',
    description: 'Get a single todo by ID',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Todo ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_todo',
    description: 'Update an existing todo',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        changelog: {
          type: 'string',
          description: 'Optional release-note text for this todo',
        },
        status: { type: 'string', enum: Object.values(TodoStatus) },
        pullRequests: {
          type: 'array',
          description:
            'Replace associated pull requests (omit to leave unchanged, pass [] to remove all)',
          items: pullRequestSchema,
        },
        pullRequest: {
          ...pullRequestSchema,
          description:
            'Add or update one associated pull request (appends; omit pullRequests when using this)',
        },
        deployedEnvironments: {
          type: 'array',
          description:
            'Replace deployed environments (omit to leave unchanged, pass [] to remove all)',
          items: deployedEnvironmentSchema,
        },
        deployedEnvironment: {
          ...deployedEnvironmentSchema,
          description:
            'Add one deployed environment (appends; omit deployedEnvironments when using this)',
        },
        associatedTicket: {
          ...associatedTicketSchema,
          description:
            'Add or update one associated external ticket (appends; omit associatedTickets when using this)',
        },
        associatedTickets: {
          type: 'array',
          description:
            'Replace associated external tickets (omit to leave unchanged, pass [] to remove all)',
          items: associatedTicketSchema,
        },
        serviceId: {
          ...todoServiceFields.serviceId,
          description:
            'Service UUID (optional; pass null to clear — ignores serviceKeyName when null)',
        },
        serviceKeyName: {
          ...todoServiceFields.serviceKeyName,
          description:
            'Service key (optional; pass null to clear — ignores serviceId when null)',
        },
        monitor: monitorInputSchema,
        testcaseScanHistory: {
          type: 'array',
          description:
            'Replace testcase scan history (omit to leave unchanged, pass [] to remove all)',
          items: testcaseScanSchema,
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'add_testcase_scan',
    description: 'Append a testcase scan history record to a todo',
    inputSchema: {
      type: 'object' as const,
      properties: {
        todoId: { type: 'string', description: 'Todo ID' },
        name: testcaseScanSchema.properties.name,
        status: testcaseScanSchema.properties.status,
        jobUrl: testcaseScanSchema.properties.jobUrl,
      },
      required: ['todoId', 'name'],
    },
  },
  {
    name: 'delete_todo',
    description: 'Delete a todo by ID',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_subtask',
    description:
      'Create a subtask for a todo. Optionally attach a monitor as part of the subtask.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        todoId: { type: 'string' },
        name: { type: 'string' },
        status: { type: 'string', enum: Object.values(SubtaskStatus) },
        monitor: {
          type: 'object',
          description: 'Optional monitor configuration (composite part of the subtask)',
          properties: {
            type: { type: 'string', enum: Object.values(MonitorType) },
            cron: {
              type: 'string',
              description: 'Cron expression e.g. */5 * * * *',
            },
            enabled: { type: 'boolean' },
            config: {
              type: 'object',
              description: deploymentMonitorConfigDescription,
            },
          },
          required: ['type', 'cron', 'config'],
        },
        pullRequests: {
          type: 'array',
          description:
            'Associated pull requests (full list; prefer pullRequest to add one)',
          items: pullRequestSchema,
        },
        pullRequest: {
          ...pullRequestSchema,
          description:
            'Associate a single pull request (use this instead of pullRequests when adding one PR)',
        },
        deployedEnvironments: {
          type: 'array',
          description:
            'Deployed environments (full list; prefer deployedEnvironment to add one)',
          items: deployedEnvironmentSchema,
        },
        deployedEnvironment: {
          ...deployedEnvironmentSchema,
          description:
            'Mark a single deployed environment (use this instead of deployedEnvironments when adding one)',
        },
      },
      required: ['todoId', 'name'],
    },
  },
  {
    name: 'update_subtask',
    description:
      'Update a subtask. Optionally update or add an attached monitor.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        todoId: { type: 'string' },
        subtaskId: { type: 'string' },
        name: { type: 'string' },
        status: { type: 'string', enum: Object.values(SubtaskStatus) },
        monitor: {
          type: 'object',
          description: 'Optional monitor configuration to update or create',
          properties: {
            type: { type: 'string', enum: Object.values(MonitorType) },
            cron: { type: 'string' },
            enabled: { type: 'boolean' },
            config: { type: 'object', description: deploymentMonitorConfigDescription },
          },
        },
        pullRequests: {
          type: 'array',
          description:
            'Replace associated pull requests (omit to leave unchanged, pass [] to remove all)',
          items: pullRequestSchema,
        },
        pullRequest: {
          ...pullRequestSchema,
          description:
            'Add or update one associated pull request (appends; omit pullRequests when using this)',
        },
        deployedEnvironments: {
          type: 'array',
          description:
            'Replace deployed environments (omit to leave unchanged, pass [] to remove all)',
          items: deployedEnvironmentSchema,
        },
        deployedEnvironment: {
          ...deployedEnvironmentSchema,
          description:
            'Add one deployed environment (appends; omit deployedEnvironments when using this)',
        },
      },
      required: ['todoId', 'subtaskId'],
    },
  },
  {
    name: 'add_associated_pull_request',
    description:
      'Associate a pull request with a todo or subtask. Appends to existing PRs without replacing them.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        todoId: { type: 'string', description: 'Todo ID' },
        subtaskId: {
          type: 'string',
          description: 'Optional subtask ID; omit to associate with the todo',
        },
        number: { type: 'number', description: 'PR number' },
        title: { type: 'string', description: 'PR title' },
        status: {
          type: 'string',
          description: 'PR status (e.g. open, closed, merged, draft)',
        },
        url: { type: 'string', description: 'URL to the pull request' },
      },
      required: ['todoId', 'number', 'title', 'status', 'url'],
    },
  },
  {
    name: 'add_associated_ticket',
    description: addAssociatedTicketDescription,
    inputSchema: {
      type: 'object' as const,
      properties: {
        todoId: { type: 'string', description: 'Todo ID' },
        title: {
          type: 'string',
          description:
            "Ticket title. When linking a Jira issue, use the Jira ticket's title exactly as shown in Jira.",
        },
        type: {
          type: 'string',
          enum: ['feature', 'bug'],
          description: 'Whether the external ticket is a feature or a bug',
        },
        link: {
          type: 'string',
          description: 'URL to the external ticket (e.g. Jira issue URL)',
        },
      },
      required: ['todoId', 'title', 'type', 'link'],
    },
  },
  {
    name: 'add_deployed_environment',
    description:
      'Record that a todo or subtask has been deployed to an environment. Appends without replacing existing environments.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        todoId: { type: 'string', description: 'Todo ID' },
        subtaskId: {
          type: 'string',
          description: 'Optional subtask ID; omit to associate with the todo',
        },
        environment: deployedEnvironmentSchema,
      },
      required: ['todoId', 'environment'],
    },
  },
  {
    name: 'list_services',
    description: 'List all predefined services (keyName and displayName)',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_service',
    description: 'Get a service by ID',
    inputSchema: serviceIdParamSchema,
  },
  {
    name: 'create_service',
    description:
      'Add a service to the catalog. keyName is immutable (lowercase slug). displayName defaults to keyName.',
    inputSchema: createServiceSchema,
  },
  {
    name: 'update_service',
    description: 'Update a service displayName (keyName cannot change)',
    inputSchema: updateServiceSchema,
  },
  {
    name: 'delete_service',
    description:
      'Delete a service. Todos referencing it will have their service cleared (SET NULL).',
    inputSchema: serviceIdParamSchema,
  },
  {
    name: 'create_release',
    description:
      'Create a staging or prod release from eligible todo IDs. Membership is stored as ReleaseMember rows. Optional deployments start Jenkins monitors.',
    inputSchema: createReleaseSchema,
  },
  {
    name: 'list_releases',
    description: 'List all releases with members and per-service deployments',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_release',
    description: 'Get a release by ID including members (active + archived) and deployments',
    inputSchema: releaseIdParamSchema,
  },
  {
    name: 'update_release',
    description:
      'Update a release: before deployments, append/remove todos or refresh content; attach/redeploy Jenkins URLs; or set status (successful completes/archives all members).',
    inputSchema: updateReleaseSchema,
  },
  {
    name: 'cancel_release',
    description: 'Cancel a release that has no deployments yet and free its member todos',
    inputSchema: releaseIdParamSchema,
  },
  {
    name: 'delete_subtask',
    description: 'Delete a subtask',
    inputSchema: {
      type: 'object' as const,
      properties: {
        todoId: { type: 'string' },
        subtaskId: { type: 'string' },
      },
      required: ['todoId', 'subtaskId'],
    },
  },
];

function createMcpServer(): Server {
  const server = new Server(
    { name: 'todo-platform', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const a = (args ?? {}) as Record<string, unknown>;

    try {
      let result: unknown;

      switch (name) {
        case 'create_todo':
          result = await api.createTodo({
            title: a.title as string,
            description: a.description as string | undefined,
            changelog: a.changelog as string | undefined,
            status: a.status as TodoStatus | undefined,
            monitor: a.monitor as CreateTodoDto['monitor'],
            pullRequests: resolveCreatePullRequests(a),
            deployedEnvironments: resolveCreateDeployedEnvironments(a),
            associatedTickets: resolveCreateAssociatedTickets(a),
            serviceId: a.serviceId as string | null | undefined,
            serviceKeyName: a.serviceKeyName as string | null | undefined,
            testcaseScanHistory: a.testcaseScanHistory as CreateTodoDto['testcaseScanHistory'],
          });
          break;
        case 'list_todos':
          result = await api.listTodos({
            status: a.status as TodoStatus | undefined,
            serviceId: a.serviceId as string | undefined,
            serviceKeyName: a.serviceKeyName as string | undefined,
            availableForRelease: a.availableForRelease as boolean | undefined,
          });
          break;
        case 'get_todo':
          result = await api.getTodo(a.id as string);
          break;
        case 'update_todo':
          result = await api.updateTodo(a.id as string, {
            title: a.title as string | undefined,
            description: a.description as string | undefined,
            changelog: a.changelog as string | undefined,
            status: a.status as TodoStatus | undefined,
            monitor: a.monitor as UpdateTodoDto['monitor'],
            pullRequests: await resolveUpdatePullRequests(api, { todoId: a.id as string }, a),
            deployedEnvironments: await resolveUpdateDeployedEnvironments(
              api,
              { todoId: a.id as string },
              a,
            ),
            associatedTickets: await resolveUpdateAssociatedTickets(
              api,
              a.id as string,
              a,
            ),
            serviceId: a.serviceId as string | null | undefined,
            serviceKeyName: a.serviceKeyName as string | null | undefined,
            testcaseScanHistory: a.testcaseScanHistory as UpdateTodoDto['testcaseScanHistory'],
          });
          break;
        case 'add_testcase_scan':
          result = await api.addTestcaseScan(a.todoId as string, {
            name: a.name as string,
            status: a.status as TestcaseScanStatus | undefined,
            jobUrl: a.jobUrl as string | undefined,
          });
          break;
        case 'delete_todo':
          await api.deleteTodo(a.id as string);
          result = { success: true, id: a.id };
          break;
        case 'create_subtask':
          result = await api.createSubtask(a.todoId as string, {
            name: a.name as string,
            status: a.status as SubtaskStatus | undefined,
            monitor: a.monitor as CreateSubtaskDto['monitor'],
            pullRequests: resolveCreatePullRequests(a),
            deployedEnvironments: resolveCreateDeployedEnvironments(a),
          });
          break;
        case 'update_subtask':
          result = await api.updateSubtask(
            a.todoId as string,
            a.subtaskId as string,
            {
              name: a.name as string | undefined,
              status: a.status as SubtaskStatus | undefined,
              monitor: a.monitor as UpdateSubtaskDto['monitor'],
              pullRequests: await resolveUpdatePullRequests(
                api,
                { todoId: a.todoId as string, subtaskId: a.subtaskId as string },
                a,
              ),
              deployedEnvironments: await resolveUpdateDeployedEnvironments(
                api,
                { todoId: a.todoId as string, subtaskId: a.subtaskId as string },
                a,
              ),
            },
          );
          break;
        case 'add_associated_pull_request':
          result = await addAssociatedPullRequest(api, a);
          break;
        case 'add_associated_ticket':
          result = await addAssociatedTicket(api, a);
          break;
        case 'add_deployed_environment':
          result = await addDeployedEnvironment(api, a);
          break;
        case 'list_services':
          result = await api.listServices();
          break;
        case 'get_service':
          result = await api.getService(a.id as string);
          break;
        case 'create_service':
          result = await api.createService({
            keyName: a.keyName as string,
            displayName: a.displayName as string | undefined,
          });
          break;
        case 'update_service':
          result = await api.updateService(a.id as string, {
            displayName: a.displayName as string | undefined,
          });
          break;
        case 'delete_service':
          await api.deleteService(a.id as string);
          result = { success: true, id: a.id };
          break;
        case 'create_release':
          result = await api.createRelease({
            type: a.type as ReleaseType,
            releaseDate: a.releaseDate as string,
            content: a.content as string,
            todoIds: a.todoIds as string[],
            deployments: a.deployments as CreateReleaseDto['deployments'],
          });
          break;
        case 'list_releases':
          result = await api.listReleases();
          break;
        case 'get_release':
          result = await api.getRelease(a.id as string);
          break;
        case 'update_release':
          result = await api.updateRelease(a.id as string, {
            content: a.content as string | undefined,
            todoIdsToAdd: a.todoIdsToAdd as string[] | undefined,
            todoIdsToRemove: a.todoIdsToRemove as string[] | undefined,
            deployments: a.deployments as UpdateReleaseDto['deployments'],
            status: a.status as UpdateReleaseDto['status'],
          });
          break;
        case 'cancel_release':
          await api.cancelRelease(a.id as string);
          result = { success: true, id: a.id };
          break;
        case 'delete_subtask':
          await api.deleteSubtask(a.todoId as string, a.subtaskId as string);
          result = { success: true, subtaskId: a.subtaskId };
          break;
        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

async function startStdio(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Todo MCP server running on stdio');
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) {
    return undefined;
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJsonRpcError(
  res: ServerResponse,
  status: number,
  code: number,
  message: string,
): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }));
}

async function startHttp(): Promise<void> {
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  async function handleMcpPost(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const sessionId = req.headers['mcp-session-id'];
    const body = await readJsonBody(req);

    try {
      let transport: StreamableHTTPServerTransport | undefined;

      if (typeof sessionId === 'string' && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
          onsessioninitialized: (newSessionId) => {
            transports[newSessionId] = transport!;
          },
        });
        transport.onclose = () => {
          const sid = transport?.sessionId;
          if (sid && transports[sid]) {
            delete transports[sid];
          }
        };
        const server = createMcpServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, body);
        return;
      } else {
        sendJsonRpcError(res, 400, -32000, 'Bad Request: No valid session ID provided');
        return;
      }

      await transport.handleRequest(req, res, body);
    } catch (error) {
      console.error('Error handling MCP POST request:', error);
      if (!res.headersSent) {
        sendJsonRpcError(res, 500, -32603, 'Internal server error');
      }
    }
  }

  async function handleMcpGet(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    // JSON-response mode: no standalone SSE stream (Cursor/SDK probe GET before session exists).
    res.writeHead(405, { Allow: 'POST, DELETE' });
    res.end('Method Not Allowed');
  }

  async function handleMcpDelete(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const sessionId = req.headers['mcp-session-id'];
    if (typeof sessionId !== 'string' || !transports[sessionId]) {
      res.writeHead(400).end('Invalid or missing session ID');
      return;
    }

    try {
      await transports[sessionId].handleRequest(req, res);
    } catch (error) {
      console.error('Error handling MCP DELETE request:', error);
      if (!res.headersSent) {
        res.writeHead(500).end('Error processing session termination');
      }
    }
  }

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${env.MCP_PORT}`);

    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (url.pathname === '/mcp') {
      console.error(`MCP ${req.method} ${url.pathname} session=${req.headers['mcp-session-id'] ?? '-'}`);
      if (req.method === 'POST') {
        await handleMcpPost(req, res);
        return;
      }
      if (req.method === 'GET') {
        await handleMcpGet(req, res);
        return;
      }
      if (req.method === 'DELETE') {
        await handleMcpDelete(req, res);
        return;
      }
      sendJsonRpcError(res, 405, -32000, 'Method not allowed');
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  httpServer.listen(env.MCP_PORT, '0.0.0.0', () => {
    console.error(`Todo MCP server running on http://0.0.0.0:${env.MCP_PORT}/mcp`);
  });
}

if (env.MCP_TRANSPORT === 'http') {
  void startHttp();
} else {
  void startStdio();
}
