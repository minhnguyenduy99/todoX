import type {
  CreateMonitorDto,
  CreateServiceDto,
  CreateSubtaskDto,
  CreateTodoDto,
  HealthResponse,
  MonitorDto,
  ServiceDto,
  SubtaskDto,
  TodoDto,
  UpdateMonitorDto,
  UpdateServiceDto,
  UpdateSubtaskDto,
  UpdateTodoDto,
} from '@todo-platform/shared-types';

export interface ApiClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
}

export class TodoApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetchFn = options.fetch ?? fetch;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API ${method} ${path} failed (${response.status}): ${errorText}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  // Todos
  listTodos(): Promise<TodoDto[]> {
    return this.request<TodoDto[]>('GET', '/todos');
  }

  getTodo(id: string): Promise<TodoDto> {
    return this.request<TodoDto>('GET', `/todos/${id}`);
  }

  createTodo(data: CreateTodoDto): Promise<TodoDto> {
    return this.request<TodoDto>('POST', '/todos', data);
  }

  updateTodo(id: string, data: UpdateTodoDto): Promise<TodoDto> {
    return this.request<TodoDto>('PATCH', `/todos/${id}`, data);
  }

  deleteTodo(id: string): Promise<void> {
    return this.request<void>('DELETE', `/todos/${id}`);
  }

  // Services
  listServices(): Promise<ServiceDto[]> {
    return this.request<ServiceDto[]>('GET', '/services');
  }

  getService(id: string): Promise<ServiceDto> {
    return this.request<ServiceDto>('GET', `/services/${id}`);
  }

  createService(data: CreateServiceDto): Promise<ServiceDto> {
    return this.request<ServiceDto>('POST', '/services', data);
  }

  updateService(id: string, data: UpdateServiceDto): Promise<ServiceDto> {
    return this.request<ServiceDto>('PATCH', `/services/${id}`, data);
  }

  deleteService(id: string): Promise<void> {
    return this.request<void>('DELETE', `/services/${id}`);
  }

  // Subtasks
  createSubtask(todoId: string, data: CreateSubtaskDto): Promise<SubtaskDto> {
    return this.request<SubtaskDto>('POST', `/todos/${todoId}/subtasks`, data);
  }

  updateSubtask(
    todoId: string,
    subtaskId: string,
    data: UpdateSubtaskDto,
  ): Promise<SubtaskDto> {
    return this.request<SubtaskDto>(
      'PATCH',
      `/todos/${todoId}/subtasks/${subtaskId}`,
      data,
    );
  }

  deleteSubtask(todoId: string, subtaskId: string): Promise<void> {
    return this.request<void>('DELETE', `/todos/${todoId}/subtasks/${subtaskId}`);
  }

  // Monitors
  listMonitors(): Promise<MonitorDto[]> {
    return this.request<MonitorDto[]>('GET', '/monitors');
  }

  getMonitor(id: string): Promise<MonitorDto> {
    return this.request<MonitorDto>('GET', `/monitors/${id}`);
  }

  createMonitor(subtaskId: string, data: CreateMonitorDto): Promise<MonitorDto> {
    return this.request<MonitorDto>('POST', `/subtasks/${subtaskId}/monitors`, data);
  }

  updateMonitor(id: string, data: UpdateMonitorDto): Promise<MonitorDto> {
    return this.request<MonitorDto>('PATCH', `/monitors/${id}`, data);
  }

  deleteMonitor(id: string): Promise<void> {
    return this.request<void>('DELETE', `/monitors/${id}`);
  }

  // Health
  getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('GET', '/health');
  }
}

export * from '@todo-platform/shared-types';
