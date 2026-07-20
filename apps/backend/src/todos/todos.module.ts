import { Module } from '@nestjs/common';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';
import { MonitorsModule } from '../monitors/monitors.module';
import { ReleasesModule } from '../releases/releases.module';

@Module({
  imports: [MonitorsModule, ReleasesModule],
  controllers: [TodosController],
  providers: [TodosService],
  exports: [TodosService],
})
export class TodosModule {}
