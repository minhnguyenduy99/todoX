import {
  Controller,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ServiceDeploymentsService } from './service-deployments.service';
import {
  CreateServiceDeploymentBody,
  UpdateServiceDeploymentBody,
} from '../common/service-deployment.dto';

@ApiTags('services')
@Controller()
export class ServiceDeploymentsController {
  constructor(private readonly serviceDeploymentsService: ServiceDeploymentsService) {}

  @Post('services/:id/deployments')
  @ApiOperation({ summary: 'Create a deployment configuration for a service' })
  create(@Param('id') serviceId: string, @Body() body: CreateServiceDeploymentBody) {
    return this.serviceDeploymentsService.create(serviceId, body);
  }

  @Patch('services/:serviceId/deployments/:deploymentId')
  @ApiOperation({ summary: 'Update a service deployment job URL' })
  update(
    @Param('serviceId') serviceId: string,
    @Param('deploymentId') deploymentId: string,
    @Body() body: UpdateServiceDeploymentBody,
  ) {
    return this.serviceDeploymentsService.update(serviceId, deploymentId, body);
  }

  @Delete('services/:serviceId/deployments/:deploymentId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a service deployment configuration' })
  remove(
    @Param('serviceId') serviceId: string,
    @Param('deploymentId') deploymentId: string,
  ) {
    return this.serviceDeploymentsService.remove(serviceId, deploymentId);
  }
}
