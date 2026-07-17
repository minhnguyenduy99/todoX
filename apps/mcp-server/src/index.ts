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
  SubtaskStatus,
  TodoStatus,
  type CreateSubtaskDto,
  type UpdateSubtaskDto,
} from '@todo-platform/shared-types';
import { createServer } from 'http';
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
      },
      required: ['title'],
    },
  },
  {
    name: 'list_todos',
    description: 'List all todos with subtasks and monitors',
    inputSchema: { type: 'object' as const, properties: {} },
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
      },
      required: ['id'],
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
              description: 'Monitor-specific configuration',
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
            config: { type: 'object' },
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
            status: a.status as TodoStatus | undefined,
            pullRequests: resolveCreatePullRequests(a),
            deployedEnvironments: resolveCreateDeployedEnvironments(a),
          });
          break;
        case 'list_todos':
          result = await api.listTodos();
          break;
        case 'get_todo':
          result = await api.getTodo(a.id as string);
          break;
        case 'update_todo':
          result = await api.updateTodo(a.id as string, {
            title: a.title as string | undefined,
            description: a.description as string | undefined,
            status: a.status as TodoStatus | undefined,
            pullRequests: await resolveUpdatePullRequests(api, { todoId: a.id as string }, a),
            deployedEnvironments: await resolveUpdateDeployedEnvironments(
              api,
              { todoId: a.id as string },
              a,
            ),
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
        case 'add_deployed_environment':
          result = await addDeployedEnvironment(api, a);
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

async function startHttp(): Promise<void> {
  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${env.MCP_PORT}`);

    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (url.pathname === '/mcp') {
      const server = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      try {
        await server.connect(transport);
        await transport.handleRequest(req, res);

        res.on('close', () => {
          void transport.close();
          void server.close();
        });
      } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32603, message: 'Internal server error' },
              id: null,
            }),
          );
        }
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  httpServer.listen(env.MCP_PORT, () => {
    console.error(`Todo MCP server running on http://localhost:${env.MCP_PORT}/mcp`);
  });
}

if (env.MCP_TRANSPORT === 'http') {
  void startHttp();
} else {
  void startStdio();
}
