import { Module, forwardRef } from '@nestjs/common';
import { MonitorsController } from './monitors.controller';
import { MonitorsService } from './monitors.service';
import {
  DeploymentMonitorProvider,
  GitHubPrMonitorProvider,
  HttpMonitorProvider,
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
    MonitorProviderRegistry,
  ],
  exports: [MonitorProviderRegistry, MonitorsService],
})
export class MonitorsModule {}
