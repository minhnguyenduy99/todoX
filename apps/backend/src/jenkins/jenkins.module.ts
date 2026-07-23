import { Module } from '@nestjs/common';
import { JenkinsJobValidationService } from './jenkins-job-validation.service';

@Module({
  providers: [JenkinsJobValidationService],
  exports: [JenkinsJobValidationService],
})
export class JenkinsModule {}
