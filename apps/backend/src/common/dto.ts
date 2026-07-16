import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MonitorType,
  SubtaskStatus,
  TodoStatus,
} from '@todo-platform/shared-types';

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
