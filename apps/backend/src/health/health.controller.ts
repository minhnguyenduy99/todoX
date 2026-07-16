import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import IORedis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/env.validation';
import type { HealthResponse } from '@todo-platform/shared-types';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check(): Promise<HealthResponse> {
    let database: 'up' | 'down' = 'down';
    let redis: 'up' | 'down' = 'down';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    try {
      const redisUrl = this.configService.get('REDIS_URL', { infer: true });
      const client = new IORedis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        lazyConnect: true,
      });
      await client.connect();
      await client.ping();
      await client.quit();
      redis = 'up';
    } catch {
      redis = 'down';
    }

    const status = database === 'up' && redis === 'up' ? 'ok' : 'error';

    return {
      status,
      timestamp: new Date().toISOString(),
      services: { database, redis },
    };
  }
}
