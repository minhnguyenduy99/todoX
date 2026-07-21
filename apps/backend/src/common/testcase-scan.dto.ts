import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestcaseScanStatus } from '@todo-platform/shared-types';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class TestcaseScanBody {
  @ApiProperty({ example: 'Regression suite' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    enum: TestcaseScanStatus,
    example: TestcaseScanStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(TestcaseScanStatus)
  status?: TestcaseScanStatus;

  @ApiPropertyOptional({
    example: 'https://jenkins-scan.example.net/job/test-scan/42/',
  })
  @IsOptional()
  @IsUrl()
  jobUrl?: string | null;
}
