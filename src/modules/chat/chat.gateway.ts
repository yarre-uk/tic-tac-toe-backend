import { UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';

import { ChatService } from './chat.service';
import { SendMessageDto } from './dtos';

import { SocketEvent } from '@/constants';
import { WsUser } from '@/decorators';
import { WsExceptionFilter } from '@/exceptions';
import { WsAuthGuard } from '@/guards';
import { WsLoggingInterceptor } from '@/interceptors';
import { Envs } from '@/libs';
import type { UserPayload } from '@/modules/auth/auth.service';

@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: Envs.FRONTEND_URL, credentials: true },
})
@UseFilters(new WsExceptionFilter())
@UseGuards(WsAuthGuard)
@UseInterceptors(new WsLoggingInterceptor())
export class ChatGateway {
  constructor(private readonly chatService: ChatService) {}

  @SubscribeMessage(SocketEvent.Chat.SEND)
  async handleSend(
    @WsUser() user: UserPayload,
    @MessageBody() dto: SendMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    const message = await this.chatService.addMessage(user.sub, dto.roomId, {
      content: dto.content,
    });

    client.to(dto.roomId).emit(SocketEvent.Chat.MESSAGE, message);

    return message;
  }
}
