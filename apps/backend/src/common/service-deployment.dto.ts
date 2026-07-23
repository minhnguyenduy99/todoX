import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, IsUrl } from 'class-validator';
import {
  DeployedEnvironmentName,
  type ServiceDeploymentEnvironment,
} from '@todo-platform/shared-types';

const SERVICE_DEPLOYMENT_ENVIRONMENTS: ServiceDeploymentEnvironment[] = [
  DeployedEnvironmentName.DEV,
  DeployedEnvironmentName.UAT,
  DeployedEnvironmentName.UAT_MAIN,
  DeployedEnvironmentName.STAGING,
  'prod',
];

export class CreateServiceDeploymentBody {
  @ApiProperty({ enum: SERVICE_DEPLOYMENT_ENVIRONMENTS, example: 'dev' })
  @IsIn(SERVICE_DEPLOYMENT_ENVIRONMENTS)
  environment!: ServiceDeploymentEnvironment;

  @ApiProperty({ example: 'https://jenkins.example.net/job/auth-dev' })
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  jobUrl!: string;
}

export class UpdateServiceDeploymentBody {
  @ApiProperty({ example: 'https://jenkins.example.net/job/auth-dev' })
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  jobUrl!: string;
}
