export type TodoViewMode = 'list' | 'kanban';

const STORAGE_KEY = 'todox.todoViewMode';

export function parseTodoViewMode(value: string | null): TodoViewMode {
  if (value === 'kanban' || value === 'list') {
    return value;
  }
  return 'list';
}

export function readTodoViewModeFromStorage(): TodoViewMode {
  try {
    return parseTodoViewMode(localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'list';
  }
}

export function syncTodoViewModeToStorage(mode: TodoViewMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors (private browsing, quota, etc.)
  }
}
