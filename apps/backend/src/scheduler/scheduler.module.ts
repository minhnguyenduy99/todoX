import { Module, forwardRef } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { MonitorsModule } from '../monitors/monitors.module';
import { ReleasesModule } from '../releases/releases.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    forwardRef(() => MonitorsModule),
    forwardRef(() => ReleasesModule),
    NotificationsModule,
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
