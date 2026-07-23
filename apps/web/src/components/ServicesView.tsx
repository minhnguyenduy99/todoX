import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DeployedEnvironmentName,
  type CreateServiceDeploymentDto,
  type ServiceDeploymentDto,
  type ServiceDeploymentEnvironment,
  type ServiceDeploymentWriteResponseDto,
  type ServiceDto,
  type UpdateServiceDeploymentDto,
} from '@todo-platform/shared-types';
import {
  createServiceDeployment,
  deleteServiceDeployment,
  fetchServices,
  updateServiceDeployment,
} from '../api';

const ENVIRONMENT_OPTIONS: ServiceDeploymentEnvironment[] = [
  DeployedEnvironmentName.DEV,
  DeployedEnvironmentName.UAT,
  DeployedEnvironmentName.UAT_MAIN,
  DeployedEnvironmentName.STAGING,
  'prod',
];

type DeploymentRowState = {
  key: string;
  deploymentId?: string;
  environment: ServiceDeploymentEnvironment;
  jobUrl: string;
  isNew: boolean;
};

function buildRows(deployments: ServiceDeploymentDto[]): DeploymentRowState[] {
  return deployments.map((deployment) => ({
    key: deployment.id,
    deploymentId: deployment.id,
    environment: deployment.environment,
    jobUrl: deployment.jobUrl,
    isNew: false,
  }));
}

function createDraftRow(): DeploymentRowState {
  return {
    key: `draft-${crypto.randomUUID()}`,
    environment: DeployedEnvironmentName.DEV,
    jobUrl: '',
    isNew: true,
  };
}

function DeploymentPreview({
  validation,
}: {
  validation: ServiceDeploymentWriteResponseDto['validation'];
}) {
  return (
    <div className="service-deployment-preview">
      <span>Validated job: {validation.jobName}</span>
      {validation.lastBuild ? (
        <span>
          Last build #{validation.lastBuild.buildNumber} ({validation.lastBuild.status})
        </span>
      ) : (
        <span>No build history yet</span>
      )}
    </div>
  );
}

function DeploymentRowEditor({
  row,
  usedEnvironments,
  onChange,
  onSave,
  onDelete,
  saving,
  error,
  lastValidation,
}: {
  row: DeploymentRowState;
  usedEnvironments: Set<ServiceDeploymentEnvironment>;
  onChange: (next: DeploymentRowState) => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
  error: string | null;
  lastValidation: ServiceDeploymentWriteResponseDto['validation'] | null;
}) {
  const availableEnvironments = ENVIRONMENT_OPTIONS.filter(
    (env) => env === row.environment || !usedEnvironments.has(env),
  );

  return (
    <div className="service-deployment-row">
      <label className="service-deployment-field">
        <span>Environment</span>
        <select
          value={row.environment}
          disabled={!row.isNew || saving}
          onChange={(event) =>
            onChange({
              ...row,
              environment: event.target.value as ServiceDeploymentEnvironment,
            })
          }
        >
          {availableEnvironments.map((env) => (
            <option key={env} value={env}>
              {env}
            </option>
          ))}
        </select>
      </label>

      <label className="service-deployment-field service-deployment-field-grow">
        <span>Jenkins job URL</span>
        <input
          type="url"
          value={row.jobUrl}
          disabled={saving}
          placeholder="https://jenkins.example.net/job/my-service-dev"
          onChange={(event) => onChange({ ...row, jobUrl: event.target.value })}
        />
      </label>

      <div className="service-deployment-actions">
        <button type="button" className="view-toggle-btn" disabled={saving || !row.jobUrl.trim()} onClick={onSave}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" className="view-toggle-btn" disabled={saving} onClick={onDelete}>
          Delete
        </button>
      </div>

      {error && <p className="service-deployment-error">{error}</p>}
      {lastValidation && <DeploymentPreview validation={lastValidation} />}
    </div>
  );
}

export function ServicesView() {
  const queryClient = useQueryClient();
  const { data: services, isLoading, error } = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
  });
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [rows, setRows] = useState<DeploymentRowState[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [rowValidations, setRowValidations] = useState<
    Record<string, ServiceDeploymentWriteResponseDto['validation']>
  >({});
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);

  const selectedService = useMemo(
    () => services?.find((service) => service.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

  const selectService = (service: ServiceDto) => {
    setSelectedServiceId(service.id);
    setRows(buildRows(service.deployments));
    setRowErrors({});
    setRowValidations({});
    setActiveRowKey(null);
  };

  const saveMutation = useMutation({
    mutationFn: async ({
      serviceId,
      row,
    }: {
      serviceId: string;
      row: DeploymentRowState;
    }) => {
      if (row.isNew) {
        const payload: CreateServiceDeploymentDto = {
          environment: row.environment,
          jobUrl: row.jobUrl.trim(),
        };
        return createServiceDeployment(serviceId, payload);
      }

      const payload: UpdateServiceDeploymentDto = {
        jobUrl: row.jobUrl.trim(),
      };
      return updateServiceDeployment(serviceId, row.deploymentId!, payload);
    },
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setRowErrors((current) => {
        const next = { ...current };
        delete next[variables.row.key];
        return next;
      });
      setRowValidations((current) => ({
        ...current,
        [variables.row.key]: response.validation,
      }));
      setRows((current) =>
        current.map((row) =>
          row.key === variables.row.key
            ? {
                key: response.deployment.id,
                deploymentId: response.deployment.id,
                environment: response.deployment.environment,
                jobUrl: response.deployment.jobUrl,
                isNew: false,
              }
            : row,
        ),
      );
      setActiveRowKey(null);
    },
    onError: (mutationError, variables) => {
      const message =
        mutationError instanceof Error ? mutationError.message : 'Failed to save deployment';
      setRowErrors((current) => ({ ...current, [variables.row.key]: message }));
      setActiveRowKey(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({
      serviceId,
      row,
    }: {
      serviceId: string;
      row: DeploymentRowState;
    }) => {
      if (!row.isNew && row.deploymentId) {
        await deleteServiceDeployment(serviceId, row.deploymentId);
      }
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setRows((current) => current.filter((row) => row.key !== variables.row.key));
      setRowErrors((current) => {
        const next = { ...current };
        delete next[variables.row.key];
        return next;
      });
      setRowValidations((current) => {
        const next = { ...current };
        delete next[variables.row.key];
        return next;
      });
    },
  });

  const usedEnvironments = useMemo(
    () => new Set(rows.map((row) => row.environment)),
    [rows],
  );

  return (
    <div className="services-view">
      <div className="services-view-header">
        <p className="release-muted">
          Configure Jenkins job URLs per environment for each service. Each save validates against Jenkins before persisting.
        </p>
      </div>

      {isLoading && <div className="loading">Loading services...</div>}

      {error && (
        <div className="error">
          Failed to load services:{' '}
          {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {!isLoading && !error && (
        <div className="services-layout">
          <aside className="services-list" aria-label="Services">
            {!services?.length && (
              <p className="subtask-panel-empty-field">No services yet. Create services via REST or MCP.</p>
            )}
            {services?.map((service) => (
              <button
                key={service.id}
                type="button"
                className={`services-list-item${selectedServiceId === service.id ? ' active' : ''}`}
                onClick={() => selectService(service)}
              >
                <span className="services-list-name">{service.displayName}</span>
                <span className="release-muted">{service.keyName}</span>
              </button>
            ))}
          </aside>

          <section className="services-editor">
            {!selectedService && (
              <p className="subtask-panel-empty-field">Select a service to edit deployment configuration.</p>
            )}

            {selectedService && (
              <>
                <div className="services-editor-header">
                  <div>
                    <h3>{selectedService.displayName}</h3>
                    <span className="release-muted">{selectedService.keyName}</span>
                  </div>
                  <button
                    type="button"
                    className="view-toggle-btn"
                    disabled={usedEnvironments.size >= ENVIRONMENT_OPTIONS.length}
                    onClick={() => setRows((current) => [...current, createDraftRow()])}
                  >
                    Add environment
                  </button>
                </div>

                {rows.length === 0 && (
                  <p className="subtask-panel-empty-field">No deployment rows yet. Add an environment to begin.</p>
                )}

                {rows.map((row) => (
                  <DeploymentRowEditor
                    key={row.key}
                    row={row}
                    usedEnvironments={usedEnvironments}
                    onChange={(next) =>
                      setRows((current) =>
                        current.map((existing) => (existing.key === row.key ? next : existing)),
                      )
                    }
                    onSave={() => {
                      if (!selectedService) return;
                      setActiveRowKey(row.key);
                      saveMutation.mutate({ serviceId: selectedService.id, row });
                    }}
                    onDelete={() => {
                      if (!selectedService) return;
                      deleteMutation.mutate({ serviceId: selectedService.id, row });
                    }}
                    saving={activeRowKey === row.key && (saveMutation.isPending || deleteMutation.isPending)}
                    error={rowErrors[row.key] ?? null}
                    lastValidation={rowValidations[row.key] ?? null}
                  />
                ))}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
