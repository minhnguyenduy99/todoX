interface TodoSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function TodoSearchInput({ value, onChange, disabled }: TodoSearchInputProps) {
  return (
    <div className="todo-search">
      <input
        className="todo-search-input"
        type="search"
        aria-label="Search todos"
        placeholder="Search todos or tickets…"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
