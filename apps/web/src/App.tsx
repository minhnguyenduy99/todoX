import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchServices, fetchTodos } from './api';
import { useWebSocket } from './hooks/useWebSocket';
import { TodoListView } from './components/TodoListView';
import { KanbanView } from './components/KanbanView';
import { ReleasesView } from './components/ReleasesView';
import { ServicesView } from './components/ServicesView';
import { ActiveDeploymentsPanel } from './components/ActiveDeploymentsPanel';
import { SideNav, type AppSection } from './components/SideNav';
import { ServiceFilterCombobox } from './components/ServiceFilterCombobox';
import { TodoSearchInput } from './components/TodoSearchInput';
import { StaleTestingSwitch } from './components/StaleTestingSwitch';
import { NotificationBell } from './components/NotificationBell';
import { todoSearchService } from './services/todo-search';
import {
  filterTodosByService,
  parseServiceFilter,
  syncServiceFilterToUrl,
  type ServiceFilterValue,
} from './utils/serviceFilter';
import { filterTodosStaleInTesting } from './utils/staleTestingFilter';
import {
  readTodoViewModeFromStorage,
  syncTodoViewModeToStorage,
  type TodoViewMode,
} from './utils/todoViewMode';

export function App() {
  const [section, setSection] = useState<AppSection>('todos');
  const [todoViewMode, setTodoViewMode] = useState<TodoViewMode>(() =>
    readTodoViewModeFromStorage(),
  );
  const [serviceFilter, setServiceFilter] = useState<ServiceFilterValue>(() =>
    parseServiceFilter(window.location.search),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [staleTestingOnly, setStaleTestingOnly] = useState(false);
  const connected = useWebSocket();
  const { data: todos, isLoading, error } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
    enabled: section === 'todos',
  });
  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
    enabled: section === 'todos',
  });

  const knownKeyNames = useMemo(
    () => new Set(services.map((service) => service.keyName)),
    [services],
  );

  useEffect(() => {
    if (services.length === 0) return;
    setServiceFilter((current) => {
      const parsed = parseServiceFilter(window.location.search, knownKeyNames);
      return filtersEqual(current, parsed) ? current : parsed;
    });
  }, [services, knownKeyNames]);

  const serviceFilteredTodos = useMemo(
    () => filterTodosByService(todos ?? [], serviceFilter),
    [todos, serviceFilter],
  );

  const staleTestingFilteredTodos = useMemo(
    () => filterTodosStaleInTesting(serviceFilteredTodos, staleTestingOnly),
    [serviceFilteredTodos, staleTestingOnly],
  );

  const filteredTodos = useMemo(
    () => todoSearchService.filterTodos(staleTestingFilteredTodos, searchQuery),
    [staleTestingFilteredTodos, searchQuery],
  );

  function handleFilterChange(nextFilter: ServiceFilterValue) {
    setServiceFilter(nextFilter);
    syncServiceFilterToUrl(nextFilter);
  }

  function handleTodoViewModeChange(mode: TodoViewMode) {
    setTodoViewMode(mode);
    syncTodoViewModeToStorage(mode);
  }

  return (
    <div className="app-shell">
      <SideNav active={section} onChange={setSection} />

      <div className="app">
        <header className="header">
          <div className="header-start">
            {section === 'todos' ? (
              <div className="header-toolbar">
                <div className="view-toggle" role="group" aria-label="Todo view mode">
                  <button
                    type="button"
                    className={`view-toggle-btn${todoViewMode === 'list' ? ' active' : ''}`}
                    onClick={() => handleTodoViewModeChange('list')}
                  >
                    List
                  </button>
                  <button
                    type="button"
                    className={`view-toggle-btn${todoViewMode === 'kanban' ? ' active' : ''}`}
                    onClick={() => handleTodoViewModeChange('kanban')}
                  >
                    Kanban
                  </button>
                </div>
                <ServiceFilterCombobox
                  value={serviceFilter}
                  services={services}
                  onChange={handleFilterChange}
                  disabled={servicesLoading}
                />
                <TodoSearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  disabled={isLoading}
                />
                <StaleTestingSwitch
                  checked={staleTestingOnly}
                  onChange={setStaleTestingOnly}
                  disabled={isLoading}
                />
              </div>
            ) : (
              <h1 className="header-title">Services</h1>
            )}
          </div>
          <div className="header-end">
            <NotificationBell />
            <div className="connection-status">
              <span className={`connection-dot ${connected ? 'connected' : ''}`} />
              {connected ? 'Live updates active' : 'Connecting...'}
            </div>
          </div>
        </header>

        {section === 'todos' && error && (
          <div className="error">
            Failed to load todos:{' '}
            {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        )}

        <div className={`app-layout${section === 'services' ? ' app-layout-full' : ''}`}>
          {section === 'todos' && (
            <aside className="app-deployments" aria-label="Today's deployments">
              <ActiveDeploymentsPanel todos={todos ?? []} />
            </aside>
          )}

          <div className="app-main">
            {section === 'todos' && isLoading && (
              <div className="loading">Loading todos...</div>
            )}

            {section === 'todos' && !isLoading && todos && todos.length === 0 && (
              <div className="empty-state">
                <h2>No todos yet</h2>
                <p>Create todos via the MCP server or REST API to see them here.</p>
              </div>
            )}

            {section === 'todos' &&
              !isLoading &&
              todos &&
              todos.length > 0 &&
              filteredTodos.length === 0 && (
                <div className="empty-state">
                  <h2>No todos match your filters</h2>
                  <p>
                    {staleTestingOnly
                      ? 'No todos have been in Testing for 3 or more days with the current filters.'
                      : 'Try clearing search, turning off Testing 3d+, selecting '}
                    {!staleTestingOnly && (
                      <>
                        <strong>All services</strong>, or choosing another service.
                      </>
                    )}
                  </p>
                </div>
              )}

            {section === 'todos' && !isLoading && filteredTodos.length > 0 && (
              todoViewMode === 'list' ? (
                <TodoListView todos={filteredTodos} />
              ) : (
                <KanbanView todos={filteredTodos} />
              )
            )}

            {section === 'services' && <ServicesView />}
          </div>

          {section === 'todos' && (
            <aside className="app-releases" aria-label="Releases">
              <ReleasesView />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

function filtersEqual(a: ServiceFilterValue, b: ServiceFilterValue): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'service' && b.kind === 'service') {
    return a.keyName === b.keyName;
  }
  return true;
}
