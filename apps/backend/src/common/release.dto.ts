import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ReleaseStatus,
  ReleaseType,
  TodoStatus,
} from '@todo-platform/shared-types';

export class ReleaseDeploymentBody {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  serviceKeyName?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  jobUrl!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  buildNumber!: number;
}

export class CreateReleaseBody {
  @ApiProperty({ enum: ReleaseType })
  @IsEnum(ReleaseType)
  type!: ReleaseType;

  @ApiProperty({ example: '2026-07-20' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'releaseDate must be yyyy-mm-dd',
  })
  releaseDate!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  todoIds!: string[];

  @ApiPropertyOptional({ type: [ReleaseDeploymentBody] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReleaseDeploymentBody)
  deployments?: ReleaseDeploymentBody[];
}

export class SplitReleaseBody {
  @ApiProperty({ example: '2026-09-10' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'releaseDate must be yyyy-mm-dd',
  })
  releaseDate!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  todoIds?: string[];
}

export class UpdateReleaseBody {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  todoIdsToAdd?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  todoIdsToRemove?: string[];

  @ApiPropertyOptional({ type: [ReleaseDeploymentBody] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReleaseDeploymentBody)
  deployments?: ReleaseDeploymentBody[];

  @ApiPropertyOptional({ enum: ReleaseStatus })
  @IsOptional()
  @IsEnum(ReleaseStatus)
  status?: ReleaseStatus;
}

export class ListTodosQuery {
  @ApiPropertyOptional({ enum: TodoStatus })
  @IsOptional()
  @IsEnum(TodoStatus)
  status?: TodoStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  serviceKeyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  availableForRelease?: boolean;
}
