import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ServiceDto } from '@todo-platform/shared-types';
import {
  getServiceFilterLabel,
  type ServiceFilterValue,
} from '../utils/serviceFilter';

interface FilterOption {
  filter: ServiceFilterValue;
  label: string;
  searchText: string;
}

interface ServiceFilterComboboxProps {
  value: ServiceFilterValue;
  services: ServiceDto[];
  onChange: (filter: ServiceFilterValue) => void;
  disabled?: boolean;
}

function buildOptions(services: ServiceDto[]): FilterOption[] {
  const sorted = [...services].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
  );

  return [
    {
      filter: { kind: 'all' },
      label: 'All services',
      searchText: 'all services',
    },
    {
      filter: { kind: 'unassigned' },
      label: 'Unassigned',
      searchText: 'unassigned no service',
    },
    ...sorted.map((service) => ({
      filter: { kind: 'service' as const, keyName: service.keyName },
      label: service.displayName,
      searchText: `${service.displayName} ${service.keyName}`.toLowerCase(),
    })),
  ];
}

function filtersEqual(a: ServiceFilterValue, b: ServiceFilterValue): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'service' && b.kind === 'service') {
    return a.keyName === b.keyName;
  }
  return true;
}

export function ServiceFilterCombobox({
  value,
  services,
  onChange,
  disabled = false,
}: ServiceFilterComboboxProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const options = useMemo(() => buildOptions(services), [services]);
  const appliedLabel = getServiceFilterLabel(value, services);

  const visibleOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => option.searchText.includes(normalized));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;

    const selectedIndex = visibleOptions.findIndex((option) =>
      filtersEqual(option.filter, value),
    );
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, visibleOptions, value]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  function selectOption(option: FilterOption) {
    onChange(option.filter);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  }

  function handleInputChange(nextQuery: string) {
    setQuery(nextQuery);
    if (!open) setOpen(true);
    setActiveIndex(0);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((index) => Math.min(index + 1, Math.max(visibleOptions.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      if (!open) {
        setOpen(true);
        return;
      }
      event.preventDefault();
      const option = visibleOptions[activeIndex];
      if (option) selectOption(option);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
    }
  }

  return (
    <div className="service-filter" ref={rootRef}>
      <div className="service-filter-control">
        <input
          ref={inputRef}
          id={`${listboxId}-input`}
          className="service-filter-input"
          type="text"
          role="combobox"
          aria-label="Filter by service"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && visibleOptions[activeIndex]
              ? `${listboxId}-option-${activeIndex}`
              : undefined
          }
          value={open ? query : appliedLabel}
          placeholder="Filter by service"
          disabled={disabled}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          onChange={(event) => handleInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        {open && (
          <ul
            id={listboxId}
            className="service-filter-listbox"
            role="listbox"
            aria-label="Service filter options"
          >
            {visibleOptions.length === 0 ? (
              <li className="service-filter-empty" role="presentation">
                No matching services
              </li>
            ) : (
              visibleOptions.map((option, index) => (
                <li
                  key={
                    option.filter.kind === 'service'
                      ? option.filter.keyName
                      : option.filter.kind
                  }
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={filtersEqual(option.filter, value)}
                  className={`service-filter-option${
                    index === activeIndex ? ' active' : ''
                  }${filtersEqual(option.filter, value) ? ' selected' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectOption(option)}
                >
                  {option.label}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
