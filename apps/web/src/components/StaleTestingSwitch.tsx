interface StaleTestingSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function StaleTestingSwitch({ checked, onChange, disabled }: StaleTestingSwitchProps) {
  return (
    <label className="stale-testing-switch">
      <span className="stale-testing-switch-label">Testing 3d+</span>
      <button
        type="button"
        role="switch"
        className={`stale-testing-switch-control${checked ? ' checked' : ''}`}
        aria-checked={checked}
        aria-label="Show todos in Testing for 3 or more days"
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="stale-testing-switch-thumb" aria-hidden="true" />
      </button>
    </label>
  );
}
