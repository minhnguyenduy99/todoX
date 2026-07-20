import { Module, forwardRef } from '@nestjs/common';
import { MonitorsModule } from '../monitors/monitors.module';
import { ReleasesController } from './releases.controller';
import { ReleasesService } from './releases.service';

@Module({
  imports: [forwardRef(() => MonitorsModule)],
  controllers: [ReleasesController],
  providers: [ReleasesService],
  exports: [ReleasesService],
})
export class ReleasesModule {}
