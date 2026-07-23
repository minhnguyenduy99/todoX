import type { ServiceDto, TodoDto } from '@todo-platform/shared-types';

export type ServiceFilterValue =
  | { kind: 'all' }
  | { kind: 'unassigned' }
  | { kind: 'service'; keyName: string };

export function parseServiceFilter(
  search: string,
  knownKeyNames?: Set<string>,
): ServiceFilterValue {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const raw = params.get('service');

  if (!raw || raw === 'all') {
    return { kind: 'all' };
  }

  if (raw === 'unassigned') {
    return { kind: 'unassigned' };
  }

  if (knownKeyNames && !knownKeyNames.has(raw)) {
    return { kind: 'all' };
  }

  return { kind: 'service', keyName: raw };
}

export function serviceFilterToQueryValue(filter: ServiceFilterValue): string | null {
  switch (filter.kind) {
    case 'all':
      return null;
    case 'unassigned':
      return 'unassigned';
    case 'service':
      return filter.keyName;
  }
}

export function filterTodosByService(
  todos: TodoDto[],
  filter: ServiceFilterValue,
): TodoDto[] {
  switch (filter.kind) {
    case 'all':
      return todos;
    case 'unassigned':
      return todos.filter((todo) => !todo.service);
    case 'service':
      return todos.filter((todo) => todo.service?.keyName === filter.keyName);
  }
}

export function getServiceFilterLabel(
  filter: ServiceFilterValue,
  services: ServiceDto[],
): string {
  switch (filter.kind) {
    case 'all':
      return 'All services';
    case 'unassigned':
      return 'Unassigned';
    case 'service': {
      const match = services.find((service) => service.keyName === filter.keyName);
      return match?.displayName ?? filter.keyName;
    }
  }
}

export function syncServiceFilterToUrl(filter: ServiceFilterValue): void {
  const url = new URL(window.location.href);
  const queryValue = serviceFilterToQueryValue(filter);

  if (queryValue === null) {
    url.searchParams.delete('service');
  } else {
    url.searchParams.set('service', queryValue);
  }

  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, '', next);
}
