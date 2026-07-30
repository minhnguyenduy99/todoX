interface TodoSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function TodoSearchInput({ value, onChange, disabled }: TodoSearchInputProps) {
  return (
    <input
      className="todo-search-input"
      type="search"
      aria-label="Search todos"
      placeholder="Search todos, tickets, or PRs…"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
