import { ApiProperty } from '@nestjs/swagger';
import { AssociatedTicketType } from '@todo-platform/shared-types';
import { IsEnum, IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class AssociatedTicketBody {
  @ApiProperty({ example: 'PROJ-123: Fix login redirect' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ enum: AssociatedTicketType, example: AssociatedTicketType.BUG })
  @IsEnum(AssociatedTicketType)
  type!: AssociatedTicketType;

  @ApiProperty({ example: 'https://jira.example.com/browse/PROJ-123' })
  @IsUrl()
  link!: string;
}
