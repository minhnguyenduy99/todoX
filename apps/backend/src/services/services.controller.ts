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
import { ServicesService } from './services.service';
import { CreateServiceBody, UpdateServiceBody } from '../common/service.dto';

@ApiTags('services')
@Controller()
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get('services')
  @ApiOperation({ summary: 'List all services' })
  findAll() {
    return this.servicesService.findAll();
  }

  @Get('services/:id')
  @ApiOperation({ summary: 'Get service by ID' })
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @Post('services')
  @ApiOperation({ summary: 'Create a service' })
  create(@Body() body: CreateServiceBody) {
    return this.servicesService.create(body);
  }

  @Patch('services/:id')
  @ApiOperation({ summary: 'Update a service' })
  update(@Param('id') id: string, @Body() body: UpdateServiceBody) {
    return this.servicesService.update(id, body);
  }

  @Delete('services/:id')
  @ApiOperation({ summary: 'Delete a service' })
  remove(@Param('id') id: string) {
    return this.servicesService.remove(id);
  }
}
