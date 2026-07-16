import {
  Controller,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SubtasksService } from './subtasks.service';
import { CreateSubtaskBody, UpdateSubtaskBody } from '../common/dto';

@ApiTags('subtasks')
@Controller('todos/:todoId/subtasks')
export class SubtasksController {
  constructor(private readonly subtasksService: SubtasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create subtask' })
  create(
    @Param('todoId') todoId: string,
    @Body() body: CreateSubtaskBody,
  ) {
    return this.subtasksService.create(todoId, body);
  }

  @Patch(':subtaskId')
  @ApiOperation({ summary: 'Update subtask' })
  update(
    @Param('todoId') todoId: string,
    @Param('subtaskId') subtaskId: string,
    @Body() body: UpdateSubtaskBody,
  ) {
    return this.subtasksService.update(todoId, subtaskId, body);
  }

  @Delete(':subtaskId')
  @ApiOperation({ summary: 'Delete subtask' })
  remove(
    @Param('todoId') todoId: string,
    @Param('subtaskId') subtaskId: string,
  ) {
    return this.subtasksService.remove(todoId, subtaskId);
  }
}
