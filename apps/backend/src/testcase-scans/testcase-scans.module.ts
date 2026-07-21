import { Module } from '@nestjs/common';
import { TestcaseScansController } from './testcase-scans.controller';
import { TestcaseScansService } from './testcase-scans.service';
import { MonitorsModule } from '../monitors/monitors.module';

@Module({
  imports: [MonitorsModule],
  controllers: [TestcaseScansController],
  providers: [TestcaseScansService],
  exports: [TestcaseScansService],
})
export class TestcaseScansModule {}
