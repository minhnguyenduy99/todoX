import { Injectable, OnModuleInit } from '@nestjs/common';
import { MonitorType, type MonitorProvider } from '@todo-platform/shared-types';
import {
  DeploymentDiscoveryMonitorProvider,
  DeploymentMonitorProvider,
  GitHubPrMonitorProvider,
  HttpMonitorProvider,
  TestcaseScanMonitorProvider,
} from './monitor-providers';

@Injectable()
export class MonitorProviderRegistry implements OnModuleInit {
  private readonly providers = new Map<string, MonitorProvider>();

  constructor(
    private readonly httpProvider: HttpMonitorProvider,
    private readonly githubPrProvider: GitHubPrMonitorProvider,
    private readonly deploymentProvider: DeploymentMonitorProvider,
    private readonly deploymentDiscoveryProvider: DeploymentDiscoveryMonitorProvider,
    private readonly testcaseScanProvider: TestcaseScanMonitorProvider,
  ) {}

  onModuleInit(): void {
    this.register(this.httpProvider);
    this.register(this.githubPrProvider);
    this.register(this.deploymentProvider);
    this.register(this.deploymentDiscoveryProvider);
    this.register(this.testcaseScanProvider);
  }

  register(provider: MonitorProvider): void {
    this.providers.set(provider.type, provider);
  }

  resolve(type: string): MonitorProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`No monitor provider registered for type: ${type}`);
    }
    return provider;
  }

  getSupportedTypes(): MonitorType[] {
    return Array.from(this.providers.keys()) as MonitorType[];
  }
}
