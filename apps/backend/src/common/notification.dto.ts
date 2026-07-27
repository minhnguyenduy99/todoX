import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationKind } from '@todo-platform/shared-types';

export class NotificationDtoClass {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: NotificationKind })
  kind!: NotificationKind;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  body!: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({ nullable: true })
  readAt!: string | null;

  @ApiProperty()
  createdAt!: string;
}
