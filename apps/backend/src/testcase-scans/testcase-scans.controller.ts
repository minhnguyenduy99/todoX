import { Controller, Delete, Param, Post, Body } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TestcaseScansService } from './testcase-scans.service';
import { TestcaseScanBody } from '../common/testcase-scan.dto';

@ApiTags('todos')
@Controller('todos/:todoId/testcase-scans')
export class TestcaseScansController {
  constructor(private readonly testcaseScansService: TestcaseScansService) {}

  @Post()
  @ApiOperation({ summary: 'Append a testcase scan history record' })
  create(@Param('todoId') todoId: string, @Body() body: TestcaseScanBody) {
    return this.testcaseScansService.create(todoId, body);
  }

  @Delete(':scanId')
  @ApiOperation({ summary: 'Delete a testcase scan history record' })
  remove(@Param('todoId') todoId: string, @Param('scanId') scanId: string) {
    return this.testcaseScansService.remove(todoId, scanId);
  }
}
