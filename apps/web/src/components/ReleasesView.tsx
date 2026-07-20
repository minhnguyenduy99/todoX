import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ReleaseType,
  type ReleaseDto,
} from '@todo-platform/shared-types';
import { fetchReleases, formatDate, releaseStatusColor, releaseStatusLabel } from '../api';

export function ReleasesView() {
  const { data: releases, isLoading, error } = useQuery({
    queryKey: ['releases'],
    queryFn: fetchReleases,
  });

  if (isLoading) {
    return (
      <div className="releases-panel">
        <h2 className="releases-panel-title">Releases</h2>
        <div className="releases-panel-status">Loading releases...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="releases-panel">
        <h2 className="releases-panel-title">Releases</h2>
        <div className="error">
          Failed to load releases:{' '}
          {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    );
  }

  if (!releases?.length) {
    return (
      <div className="releases-panel">
        <h2 className="releases-panel-title">Releases</h2>
        <div className="releases-panel-empty">
          <p>No releases yet</p>
          <p className="release-muted">
            Create releases via MCP or REST to track staging and prod deploys here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="releases-panel">
      <h2 className="releases-panel-title">Releases</h2>
      <div className="releases-view">
        {releases.map((release) => (
          <ReleaseCard key={release.id} release={release} />
        ))}
      </div>
    </div>
  );
}

function ReleaseCard({ release }: { release: ReleaseDto }) {
  const [expanded, setExpanded] = useState(false);
  const truncated =
    release.content.length > 280 && !expanded
      ? `${release.content.slice(0, 280)}…`
      : release.content;

  return (
    <article className="release-card">
      <header className="release-card-header">
        <div className="release-card-title-row">
          <h2>{release.releaseDate}</h2>
          <span className={`badge ${release.type === ReleaseType.PROD ? 'badge-red' : 'badge-purple'}`}>
            {release.type}
          </span>
          <span className={`badge ${releaseStatusColor(release.status)}`}>
            {releaseStatusLabel(release.status)}
          </span>
        </div>
        <p className="release-meta">Updated {formatDate(release.updatedAt)}</p>
      </header>

      <pre className={`release-content${expanded ? ' expanded' : ''}`}>{truncated}</pre>
      {release.content.length > 280 && (
        <button
          type="button"
          className="release-expand-btn"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}

      <section className="release-section">
        <h3>Members</h3>
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
      </section>

      <section className="release-section">
        <h3>Deployments</h3>
        {release.deployments.length === 0 ? (
          <p className="release-muted">No deployment URLs attached yet.</p>
        ) : (
          <ul className="release-deployment-list">
            {release.deployments.map((deployment) => (
              <li key={deployment.id}>
                <span className="release-service-chip">{deployment.serviceKeyName}</span>
                <span className={`badge ${releaseDeploymentStatusColor(deployment.status)}`}>
                  {deployment.status.replaceAll('_', ' ')}
                </span>
                {deployment.buildNumber != null && (
                  <span className="release-muted">#{deployment.buildNumber}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

function releaseDeploymentStatusColor(status: string): string {
  switch (status) {
    case 'successful':
      return 'badge-green';
    case 'failed':
      return 'badge-red';
    case 'in_progress':
      return 'badge-blue';
    default:
      return 'badge-gray';
  }
}
