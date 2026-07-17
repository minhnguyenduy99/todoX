import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssociatedPullRequestBody {
  @ApiProperty({ example: 42 })
  @IsInt()
  @Min(1)
  number!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'open' })
  @IsString()
  @IsNotEmpty()
  status!: string;

  @ApiProperty({ example: 'https://github.com/org/repo/pull/42' })
  @IsUrl()
  url!: string;
}
