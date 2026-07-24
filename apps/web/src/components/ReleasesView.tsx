import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ReleaseType,
  ReleaseDeploymentStatus,
  type ReleaseDeploymentDto,
  type ReleaseDto,
} from '@todo-platform/shared-types';
import { fetchReleases, formatDate, releaseStatusColor, releaseStatusLabel } from '../api';
import {
  releaseDeploymentStatusChipClassName,
  resolveReleaseDeploymentBuildUrl,
} from '../utils/deploymentDisplay';

export function ReleasesView() {
  const [selectedRelease, setSelectedRelease] = useState<ReleaseDto | null>(null);
  const { data: releases, isLoading, error } = useQuery({
    queryKey: ['releases'],
    queryFn: fetchReleases,
  });

  return (
    <div className="releases-panel">
      <h2 className="releases-panel-title">Releases</h2>

      {isLoading && (
        <div className="releases-panel-status">Loading releases...</div>
      )}

      {error && (
        <div className="error">
          Failed to load releases:{' '}
          {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {!isLoading && !error && !releases?.length && (
        <div className="releases-panel-empty">
          <p>No releases yet</p>
          <p className="release-muted">
            Create releases via MCP or REST to track staging and prod deploys here.
          </p>
        </div>
      )}

      {!isLoading && !error && !!releases?.length && (
        <div className="releases-view">
          {releases.map((release) => (
            <button
              key={release.id}
              type="button"
              className="release-summary"
              onClick={() => setSelectedRelease(release)}
            >
              <div className="release-summary-top">
                <div className="release-summary-left">
                  <span className="release-summary-date">{release.releaseDate}</span>
                  <span
                    className={
                      release.type === ReleaseType.PROD
                        ? 'release-type release-type-prod'
                        : 'release-type release-type-staging'
                    }
                  >
                    {release.type}
                  </span>
                </div>
                <span className={`badge badge-sm ${releaseStatusColor(release.status)}`}>
                  {releaseStatusLabel(release.status)}
                </span>
              </div>
              <span className="release-meta">Updated {formatDate(release.updatedAt)}</span>
            </button>
          ))}
        </div>
      )}

      {selectedRelease && (
        <ReleasePanel
          release={selectedRelease}
          onClose={() => setSelectedRelease(null)}
        />
      )}
    </div>
  );
}

function ReleasePanel({
  release,
  onClose,
}: {
  release: ReleaseDto;
  onClose: () => void;
}) {
  const [contentCopied, setContentCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  async function handleCopyContent() {
    if (!release.content) return;
    try {
      await navigator.clipboard.writeText(release.content);
      setContentCopied(true);
      window.setTimeout(() => setContentCopied(false), 1500);
    } catch {
      // Clipboard access may be unavailable.
    }
  }

  return (
    <div className="subtask-panel-overlay" onClick={onClose}>
      <div
        className="subtask-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-panel-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="subtask-panel-header">
          <div className="subtask-panel-header-content">
            <h2 id="release-panel-title" className="subtask-panel-title">
              {release.releaseDate}
            </h2>
          </div>
          <button type="button" className="subtask-panel-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="subtask-panel-body">
          <section className="subtask-panel-field">
            <h3 className="subtask-panel-label">Type</h3>
            <span
              className={
                release.type === ReleaseType.PROD
                  ? 'release-type release-type-prod'
                  : 'release-type release-type-staging'
              }
            >
              {release.type}
            </span>
          </section>

          <section className="subtask-panel-field">
            <h3 className="subtask-panel-label">Status</h3>
            <span className={`badge release-status-chip ${releaseStatusColor(release.status)}`}>
              {releaseStatusLabel(release.status)}
            </span>
          </section>

          <section className="subtask-panel-field">
            <h3 className="subtask-panel-label">Updated</h3>
            <p className="release-meta">{formatDate(release.updatedAt)}</p>
          </section>

          <section className="subtask-panel-field">
            <div className="release-field-heading">
              <h3 className="subtask-panel-label">Content</h3>
              {release.content ? (
                <button
                  type="button"
                  className="release-copy-btn"
                  onClick={handleCopyContent}
                  aria-label="Copy release content"
                >
                  {contentCopied ? 'Copied!' : 'Copy'}
                </button>
              ) : null}
            </div>
            {release.content ? (
              <div className="subtask-panel-description-content">
                <pre className="release-content">{release.content}</pre>
              </div>
            ) : (
              <p className="subtask-panel-empty-field">No content</p>
            )}
          </section>

          <section className="subtask-panel-field">
            <h3 className="subtask-panel-label">Members</h3>
            {release.members.length === 0 ? (
              <p className="subtask-panel-empty-field">No members</p>
            ) : (
              <ul className="release-member-list">
                {release.members.map((member) => (
                  <li key={`${member.todoId}-${member.archived ? 'archived' : 'active'}`}>
                    <span>{member.title}</span>
                    {member.serviceKeyName && (
                      <span className="release-service-chip">{member.serviceKeyName}</span>
                    )}
                    {member.archived && <span className="badge badge-gray">archived</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="subtask-panel-field">
            <h3 className="subtask-panel-label">Deployments</h3>
            {release.deployments.length === 0 ? (
              <p className="subtask-panel-empty-field">No deployment URLs attached yet.</p>
            ) : (
              <ul className="release-deployment-list">
                {release.deployments.map((deployment) => (
                  <ReleaseDeploymentItem key={deployment.id} deployment={deployment} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ReleaseDeploymentItem({ deployment }: { deployment: ReleaseDeploymentDto }) {
  const buildUrl = resolveReleaseDeploymentBuildUrl(deployment);
  const chipClassName = `env-chip ${releaseDeploymentStatusChipClassName(deployment.status)} release-deployment-chip`;
  const statusLabel = deployment.status.replaceAll('_', ' ');
  const titleParts = [
    deployment.serviceKeyName,
    deployment.environment,
    statusLabel,
  ];
  if (deployment.buildNumber != null) titleParts.push(`#${deployment.buildNumber}`);
  if (buildUrl) titleParts.push(buildUrl);
  const title = titleParts.join(' · ');

  const chipContent = (
    <>
      <span
        className={`env-chip-label${deployment.status === ReleaseDeploymentStatus.IN_PROGRESS ? ' env-chip-label-marquee' : ''}`}
      >
        {deployment.serviceKeyName}
      </span>
      <span className="env-chip-meta">
        {deployment.status === ReleaseDeploymentStatus.IN_PROGRESS && (
          <span className="env-chip-spinner" aria-hidden="true" />
        )}
        <span className="env-chip-build">{statusLabel}</span>
        {deployment.buildNumber != null && (
          <span className="env-chip-duration">#{deployment.buildNumber}</span>
        )}
      </span>
    </>
  );

  return (
    <li className="release-deployment-item">
      {buildUrl ? (
        <a
          className={chipClassName}
          href={buildUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={title}
        >
          {chipContent}
        </a>
      ) : (
        <span className={chipClassName} title={title}>
          {chipContent}
        </span>
      )}
    </li>
  );
}
