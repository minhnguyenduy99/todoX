import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateReleaseBody,
  SplitReleaseBody,
  UpdateReleaseBody,
} from '../common/release.dto';
import { ReleasesService } from './releases.service';

@ApiTags('releases')
@Controller('releases')
export class ReleasesController {
  constructor(private readonly releasesService: ReleasesService) {}

  @Get()
  @ApiOperation({ summary: 'List all releases' })
  findAll() {
    return this.releasesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get release by ID' })
  findOne(@Param('id') id: string) {
    return this.releasesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a release from todos' })
  create(@Body() body: CreateReleaseBody) {
    return this.releasesService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update release draft membership/content or attach deployments' })
  update(@Param('id') id: string, @Body() body: UpdateReleaseBody) {
    return this.releasesService.update(id, body);
  }

  @Post(':id/split')
  @ApiOperation({
    summary:
      'Move non-successful-service todos to a new release and mark the source successful',
  })
  split(@Param('id') id: string, @Body() body: SplitReleaseBody) {
    return this.releasesService.split(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Delete/cancel a non-successful release when no member service has deployed successfully',
  })
  cancel(@Param('id') id: string) {
    return this.releasesService.cancel(id);
  }
}
