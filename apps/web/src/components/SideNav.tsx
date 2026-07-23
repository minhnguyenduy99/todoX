export type AppSection = 'todos' | 'services';

type SideNavProps = {
  active: AppSection;
  onChange: (section: AppSection) => void;
};

function TodoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="side-nav-icon">
      <path
        d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ServicesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="side-nav-icon">
      <path
        d="M4 7h16M4 12h16M4 17h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="18" cy="17" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

const NAV_ITEMS: { id: AppSection; label: string; icon: typeof TodoIcon }[] = [
  { id: 'todos', label: 'Todos', icon: TodoIcon },
  { id: 'services', label: 'Services', icon: ServicesIcon },
];

export function SideNav({ active, onChange }: SideNavProps) {
  return (
    <nav className="side-nav" aria-label="Main navigation">
      <div className="side-nav-brand" aria-hidden="true">
        <span className="side-nav-brand-mark">T</span>
        <span className="side-nav-label">Todo Platform</span>
      </div>

      <ul className="side-nav-list">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <li key={id}>
            <button
              type="button"
              className={`side-nav-item${active === id ? ' active' : ''}`}
              aria-current={active === id ? 'page' : undefined}
              title={label}
              onClick={() => onChange(id)}
            >
              <Icon />
              <span className="side-nav-label">{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
