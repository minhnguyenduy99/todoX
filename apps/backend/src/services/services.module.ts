import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { ServiceDeploymentsController } from './service-deployments.controller';
import { ServiceDeploymentsService } from './service-deployments.service';
import { JenkinsModule } from '../jenkins/jenkins.module';

@Module({
  imports: [JenkinsModule],
  controllers: [ServicesController, ServiceDeploymentsController],
  providers: [ServicesService, ServiceDeploymentsService],
  exports: [ServicesService],
})
export class ServicesModule {}
