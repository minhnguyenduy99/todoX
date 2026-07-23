import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ServiceDeployment } from '@prisma/client';
import type {
  CreateServiceDeploymentDto,
  ServiceDeploymentDto,
  ServiceDeploymentWriteResponseDto,
  UpdateServiceDeploymentDto,
} from '@todo-platform/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { JenkinsJobValidationService } from '../jenkins/jenkins-job-validation.service';
import { toServiceDeploymentDto } from '../common/mappers';

@Injectable()
export class ServiceDeploymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jenkinsValidation: JenkinsJobValidationService,
  ) {}

  async create(
    serviceId: string,
    dto: CreateServiceDeploymentDto,
  ): Promise<ServiceDeploymentWriteResponseDto> {
    await this.ensureServiceExists(serviceId);

    const existing = await this.prisma.serviceDeployment.findUnique({
      where: {
        serviceId_environment: {
          serviceId,
          environment: dto.environment,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Deployment for environment '${dto.environment}' already exists for this service`,
      );
    }

    const validation = await this.jenkinsValidation.validateJobUrl(dto.jobUrl);
    if (!validation.valid || !validation.preview) {
      throw new BadRequestException(validation.error ?? 'Invalid Jenkins job URL');
    }

    const deployment = await this.prisma.serviceDeployment.create({
      data: {
        serviceId,
        environment: dto.environment,
        jobUrl: validation.preview.normalizedJobUrl,
      },
    });

    return this.toWriteResponse(deployment, validation.preview);
  }

  async update(
    serviceId: string,
    deploymentId: string,
    dto: UpdateServiceDeploymentDto,
  ): Promise<ServiceDeploymentWriteResponseDto> {
    const deployment = await this.findOwnedDeployment(serviceId, deploymentId);

    const validation = await this.jenkinsValidation.validateJobUrl(dto.jobUrl);
    if (!validation.valid || !validation.preview) {
      throw new BadRequestException(validation.error ?? 'Invalid Jenkins job URL');
    }

    const updated = await this.prisma.serviceDeployment.update({
      where: { id: deployment.id },
      data: { jobUrl: validation.preview.normalizedJobUrl },
    });

    return this.toWriteResponse(updated, validation.preview);
  }

  async remove(serviceId: string, deploymentId: string): Promise<void> {
    const deployment = await this.findOwnedDeployment(serviceId, deploymentId);
    await this.prisma.serviceDeployment.delete({ where: { id: deployment.id } });
  }

  private async findOwnedDeployment(
    serviceId: string,
    deploymentId: string,
  ): Promise<ServiceDeployment> {
    const deployment = await this.prisma.serviceDeployment.findFirst({
      where: { id: deploymentId, serviceId },
    });
    if (!deployment) {
      throw new NotFoundException(
        `Service deployment ${deploymentId} not found for service ${serviceId}`,
      );
    }
    return deployment;
  }

  private async ensureServiceExists(serviceId: string): Promise<void> {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      throw new NotFoundException(`Service ${serviceId} not found`);
    }
  }

  private toWriteResponse(
    deployment: ServiceDeployment,
    validation: NonNullable<
      Awaited<ReturnType<JenkinsJobValidationService['validateJobUrl']>>['preview']
    >,
  ): ServiceDeploymentWriteResponseDto {
    return {
      deployment: toServiceDeploymentDto(deployment),
      validation,
    };
  }
}
