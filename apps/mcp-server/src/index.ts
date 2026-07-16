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
} from '@todo-platform/shared-types';
import { createServer } from 'http';
import { validateMcpEnv } from './config.js';

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
    description: 'Create a subtask for a todo',
    inputSchema: {
      type: 'object' as const,
      properties: {
        todoId: { type: 'string' },
        name: { type: 'string' },
        status: { type: 'string', enum: Object.values(SubtaskStatus) },
      },
      required: ['todoId', 'name'],
    },
  },
  {
    name: 'update_subtask',
    description: 'Update a subtask',
    inputSchema: {
      type: 'object' as const,
      properties: {
        todoId: { type: 'string' },
        subtaskId: { type: 'string' },
        name: { type: 'string' },
        status: { type: 'string', enum: Object.values(SubtaskStatus) },
      },
      required: ['todoId', 'subtaskId'],
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
  {
    name: 'setup_monitor',
    description: 'Set up a monitor for a subtask',
    inputSchema: {
      type: 'object' as const,
      properties: {
        subtaskId: { type: 'string' },
        type: { type: 'string', enum: Object.values(MonitorType) },
        cron: { type: 'string', description: 'Cron expression e.g. */5 * * * *' },
        enabled: { type: 'boolean' },
        config: { type: 'object', description: 'Monitor-specific configuration' },
      },
      required: ['subtaskId', 'type', 'cron', 'config'],
    },
  },
  {
    name: 'remove_monitor',
    description: 'Remove a monitor by ID',
    inputSchema: {
      type: 'object' as const,
      properties: {
        monitorId: { type: 'string' },
      },
      required: ['monitorId'],
    },
  },
  {
    name: 'list_monitors',
    description: 'List all monitors',
    inputSchema: { type: 'object' as const, properties: {} },
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
          });
          break;
        case 'update_subtask':
          result = await api.updateSubtask(
            a.todoId as string,
            a.subtaskId as string,
            {
              name: a.name as string | undefined,
              status: a.status as SubtaskStatus | undefined,
            },
          );
          break;
        case 'delete_subtask':
          await api.deleteSubtask(a.todoId as string, a.subtaskId as string);
          result = { success: true, subtaskId: a.subtaskId };
          break;
        case 'setup_monitor':
          result = await api.createMonitor(a.subtaskId as string, {
            type: a.type as MonitorType,
            cron: a.cron as string,
            enabled: a.enabled as boolean | undefined,
            config: a.config as Record<string, unknown>,
          });
          break;
        case 'remove_monitor':
          await api.deleteMonitor(a.monitorId as string);
          result = { success: true, monitorId: a.monitorId };
          break;
        case 'list_monitors':
          result = await api.listMonitors();
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
