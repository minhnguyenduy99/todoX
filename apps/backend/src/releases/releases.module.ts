import { Module, forwardRef } from '@nestjs/common';
import { MonitorsModule } from '../monitors/monitors.module';
import { ReleasesController } from './releases.controller';
import { ReleaseDeploymentDiscoveryService } from './release-deployment-discovery.service';
import { ReleasesService } from './releases.service';

@Module({
  imports: [forwardRef(() => MonitorsModule)],
  controllers: [ReleasesController],
  providers: [ReleasesService, ReleaseDeploymentDiscoveryService],
  exports: [ReleasesService, ReleaseDeploymentDiscoveryService],
})
export class ReleasesModule {}
