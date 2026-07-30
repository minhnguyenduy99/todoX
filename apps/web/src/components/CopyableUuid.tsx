import { useCallback, useState } from 'react';

interface CopyableUuidProps {
  uuid: string;
  compact?: boolean;
  iconOnly?: boolean;
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="copyable-uuid-icon">
      <path
        fill="currentColor"
        d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="copyable-uuid-icon">
      <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  );
}

function truncateUuid(uuid: string): string {
  return uuid.length > 8 ? `${uuid.slice(0, 8)}…` : uuid;
}

export function CopyableUuid({ uuid, compact = false, iconOnly = false }: CopyableUuidProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      try {
        await navigator.clipboard.writeText(uuid);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } catch {
        // Clipboard access may be unavailable.
      }
    },
    [uuid],
  );

  const displayText = copied
    ? 'Copied!'
    : compact
      ? `#${truncateUuid(uuid)}`
      : `#${uuid}`;

  if (iconOnly) {
    return (
      <button
        type="button"
        className={`copyable-uuid copyable-uuid-icon-btn${copied ? ' copyable-uuid-icon-btn-copied' : ''}`}
        onClick={handleCopy}
        title={copied ? 'Copied!' : uuid}
        aria-label={copied ? 'Release ID copied' : `Copy release ID ${uuid}`}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="copyable-uuid"
      onClick={handleCopy}
      title={compact ? uuid : 'Copy UUID'}
      aria-label={`Copy UUID ${uuid}`}
    >
      {displayText}
    </button>
  );
}
