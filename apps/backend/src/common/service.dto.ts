import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

const KEY_NAME_PATTERN = /^[a-z0-9_-]+$/;

export class CreateServiceBody {
  @ApiProperty({ example: 'billing-api' })
  @IsString()
  @IsNotEmpty()
  @Matches(KEY_NAME_PATTERN, {
    message: 'keyName must contain only lowercase letters, numbers, underscores, and hyphens',
  })
  keyName!: string;

  @ApiPropertyOptional({ example: 'Billing API' })
  @IsOptional()
  @IsString()
  displayName?: string;
}

export class UpdateServiceBody {
  @ApiPropertyOptional({ example: 'Billing API' })
  @IsOptional()
  @IsString()
  displayName?: string | null;
}
