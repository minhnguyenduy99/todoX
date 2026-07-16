import { Module, forwardRef } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { MonitorsModule } from '../monitors/monitors.module';

@Module({
  imports: [forwardRef(() => MonitorsModule)],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
