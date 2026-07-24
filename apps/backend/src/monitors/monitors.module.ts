import { Module, forwardRef } from '@nestjs/common';
import { MonitorsController } from './monitors.controller';
import { MonitorsService } from './monitors.service';
import {
  DeploymentDiscoveryMonitorProvider,
  DeploymentMonitorProvider,
  GitHubPrMonitorProvider,
  HttpMonitorProvider,
  TestcaseScanMonitorProvider,
} from './providers/monitor-providers';
import { MonitorProviderRegistry } from './providers/monitor-provider.registry';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
  imports: [forwardRef(() => SchedulerModule)],
  controllers: [MonitorsController],
  providers: [
    MonitorsService,
    HttpMonitorProvider,
    GitHubPrMonitorProvider,
    DeploymentMonitorProvider,
    DeploymentDiscoveryMonitorProvider,
    TestcaseScanMonitorProvider,
    MonitorProviderRegistry,
  ],
  exports: [MonitorProviderRegistry, MonitorsService],
})
export class MonitorsModule {}
