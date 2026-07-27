import { Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationDtoClass } from '../common/notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications from the last 24 hours' })
  findRecent(): Promise<NotificationDtoClass[]> {
    return this.notificationsService.findRecent();
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@Param('id') id: string): Promise<NotificationDtoClass> {
    return this.notificationsService.markRead(id);
  }

  @Post('read-all')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mark all recent notifications as read' })
  async markAllRead(): Promise<void> {
    await this.notificationsService.markAllRead();
  }
}
