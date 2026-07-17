import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MonitorType,
  SubtaskStatus,
  TodoStatus,
} from '@todo-platform/shared-types';
import { AssociatedPullRequestBody } from './pull-request.dto';

export class CreateTodoBody {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TodoStatus })
  @IsOptional()
  @IsEnum(TodoStatus)
  status?: TodoStatus;

  @ApiPropertyOptional({ type: [AssociatedPullRequestBody] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssociatedPullRequestBody)
  pullRequests?: AssociatedPullRequestBody[];
}

export class UpdateTodoBody {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TodoStatus })
  @IsOptional()
  @IsEnum(TodoStatus)
  status?: TodoStatus;

  @ApiPropertyOptional({ type: [AssociatedPullRequestBody] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssociatedPullRequestBody)
  pullRequests?: AssociatedPullRequestBody[];
}

export class CreateSubtaskMonitorBody {
  @ApiProperty({ enum: MonitorType })
  @IsEnum(MonitorType)
  type!: MonitorType;

  @ApiProperty({ example: '*/5 * * * *' })
  @IsString()
  @IsNotEmpty()
  cron!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  config!: Record<string, unknown>;
}

export class UpdateSubtaskMonitorBody {
  @ApiPropertyOptional({ enum: MonitorType })
  @IsOptional()
  @IsEnum(MonitorType)
  type?: MonitorType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cron?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class CreateSubtaskBody {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ enum: SubtaskStatus })
  @IsOptional()
  @IsEnum(SubtaskStatus)
  status?: SubtaskStatus;

  @ApiPropertyOptional({ type: CreateSubtaskMonitorBody })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateSubtaskMonitorBody)
  monitor?: CreateSubtaskMonitorBody;

  @ApiPropertyOptional({ type: [AssociatedPullRequestBody] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssociatedPullRequestBody)
  pullRequests?: AssociatedPullRequestBody[];
}

export class UpdateSubtaskBody {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ enum: SubtaskStatus })
  @IsOptional()
  @IsEnum(SubtaskStatus)
  status?: SubtaskStatus;

  @ApiPropertyOptional({ type: UpdateSubtaskMonitorBody })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSubtaskMonitorBody)
  monitor?: UpdateSubtaskMonitorBody;

  @ApiPropertyOptional({ type: [AssociatedPullRequestBody] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssociatedPullRequestBody)
  pullRequests?: AssociatedPullRequestBody[];
}

export class CreateMonitorBody {
  @ApiProperty({ enum: MonitorType })
  @IsEnum(MonitorType)
  type!: MonitorType;

  @ApiProperty({ example: '*/5 * * * *' })
  @IsString()
  @IsNotEmpty()
  cron!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  config!: Record<string, unknown>;
}

export class UpdateMonitorBody {
  @ApiPropertyOptional({ enum: MonitorType })
  @IsOptional()
  @IsEnum(MonitorType)
  type?: MonitorType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cron?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
