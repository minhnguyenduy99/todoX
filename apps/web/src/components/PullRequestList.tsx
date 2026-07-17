import type { MouseEvent } from 'react';
import type { AssociatedPullRequestDto } from '@todo-platform/shared-types';

interface PullRequestListProps {
  pullRequests: AssociatedPullRequestDto[];
  compact?: boolean;
}

function PullRequestIcon() {
  return (
    <svg
      className="pr-icon"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-1.762a1.5 1.5 0 0 0-2.152.88 1.5 1.5 0 0 0 .88 2.152h.001l4.315 1.737a.75.75 0 0 1 .557.729v3.085a2.251 2.251 0 1 1-1.5 0V9.266l-4.315-1.737a3 3 0 0 1-1.786-2.748ZM11.54 1.5a2.25 2.25 0 1 1 3 2.121v5.256a2.25 2.25 0 1 1-1.5 0V3.621A2.25 2.25 0 0 1 11.54 1.5Z" />
    </svg>
  );
}

function prStatusClassName(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'merged') return 'pr-status-merged';
  if (normalized === 'open') return 'pr-status-open';
  if (normalized === 'draft') return 'pr-status-draft';
  return 'pr-status-closed';
}

function prChipClassName(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'merged') return 'pr-chip-merged';
  if (normalized === 'open') return 'pr-chip-open';
  if (normalized === 'draft') return 'pr-chip-draft';
  return 'pr-chip-closed';
}

function handlePrClick(e: MouseEvent, url: string) {
  e.stopPropagation();
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function PullRequestList({ pullRequests, compact = false }: PullRequestListProps) {
  if (pullRequests.length === 0) return null;

  if (compact) {
    return (
      <div className="pr-list pr-list-compact">
        {pullRequests.map((pr) => (
          <a
            key={pr.id}
            className={`pr-chip ${prChipClassName(pr.status)}`}
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={pr.title}
          >
            <PullRequestIcon />
            <span>#{pr.number}</span>
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="pr-list">
      {pullRequests.map((pr) => (
        <a
          key={pr.id}
          className={`pr-item ${prStatusClassName(pr.status)}`}
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => handlePrClick(e, pr.url)}
        >
          <span className="pr-number">#{pr.number}</span>
          <span className="pr-title">{pr.title}</span>
          <span className={`pr-status ${prStatusClassName(pr.status)}`}>{pr.status}</span>
        </a>
      ))}
    </div>
  );
}
