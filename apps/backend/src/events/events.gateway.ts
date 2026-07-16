import { Injectable } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server } from 'ws';
import type { WebSocketEvent, WebSocketEventType } from '@todo-platform/shared-types';
import { Logger } from 'nestjs-pino';

@Injectable()
@WebSocketGateway({ path: '/ws' })
export class EventsGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly logger: Logger) {}

  afterInit(): void {
    this.logger.log('WebSocket gateway initialized at /ws');
  }

  broadcast<T>(type: WebSocketEventType, payload: T): void {
    if (!this.server) return;

    const event: WebSocketEvent<T> = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    const message = JSON.stringify(event);
    this.server.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }
}
