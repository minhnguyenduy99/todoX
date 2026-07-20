import { Module, forwardRef } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { MonitorsModule } from '../monitors/monitors.module';
import { ReleasesModule } from '../releases/releases.module';

@Module({
  imports: [
    forwardRef(() => MonitorsModule),
    forwardRef(() => ReleasesModule),
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
