import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { TodosModule } from './todos/todos.module';
import { SubtasksModule } from './subtasks/subtasks.module';
import { MonitorsModule } from './monitors/monitors.module';
import { ServicesModule } from './services/services.module';
import { ReleasesModule } from './releases/releases.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { TestcaseScansModule } from './testcase-scans/testcase-scans.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      },
    }),
    PrismaModule,
    EventsModule,
    TodosModule,
    SubtasksModule,
    MonitorsModule,
    ServicesModule,
    ReleasesModule,
    SchedulerModule,
    HealthModule,
    TestcaseScansModule,
  ],
})
export class AppModule {}
