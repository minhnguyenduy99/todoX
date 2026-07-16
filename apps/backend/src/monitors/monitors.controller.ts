import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MonitorsService } from './monitors.service';
import { CreateMonitorBody, UpdateMonitorBody } from '../common/dto';

@ApiTags('monitors')
@Controller()
export class MonitorsController {
  constructor(private readonly monitorsService: MonitorsService) {}

  @Get('monitors')
  @ApiOperation({ summary: 'List all monitors' })
  findAll() {
    return this.monitorsService.findAll();
  }

  @Get('monitors/:id')
  @ApiOperation({ summary: 'Get monitor by ID' })
  findOne(@Param('id') id: string) {
    return this.monitorsService.findOne(id);
  }

  @Post('subtasks/:subtaskId/monitors')
  @ApiOperation({ summary: 'Create monitor for subtask' })
  create(
    @Param('subtaskId') subtaskId: string,
    @Body() body: CreateMonitorBody,
  ) {
    return this.monitorsService.create(subtaskId, body);
  }

  @Patch('monitors/:id')
  @ApiOperation({ summary: 'Update monitor' })
  update(@Param('id') id: string, @Body() body: UpdateMonitorBody) {
    return this.monitorsService.update(id, body);
  }

  @Delete('monitors/:id')
  @ApiOperation({ summary: 'Delete monitor' })
  remove(@Param('id') id: string) {
    return this.monitorsService.remove(id);
  }
}
