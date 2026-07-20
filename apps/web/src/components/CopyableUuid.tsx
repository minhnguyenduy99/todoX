import { useCallback, useState } from 'react';

interface CopyableUuidProps {
  uuid: string;
  compact?: boolean;
}

function truncateUuid(uuid: string): string {
  return uuid.length > 8 ? `${uuid.slice(0, 8)}…` : uuid;
}

export function CopyableUuid({ uuid, compact = false }: CopyableUuidProps) {
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
