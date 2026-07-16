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
import { TodosService } from './todos.service';
import { CreateTodoBody, UpdateTodoBody } from '../common/dto';

@ApiTags('todos')
@Controller('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Get()
  @ApiOperation({ summary: 'List all todos' })
  findAll() {
    return this.todosService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get todo by ID' })
  findOne(@Param('id') id: string) {
    return this.todosService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create todo' })
  create(@Body() body: CreateTodoBody) {
    return this.todosService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update todo' })
  update(@Param('id') id: string, @Body() body: UpdateTodoBody) {
    return this.todosService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete todo' })
  remove(@Param('id') id: string) {
    return this.todosService.remove(id);
  }
}
