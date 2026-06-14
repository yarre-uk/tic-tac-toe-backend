import { UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

import { ChatService } from './chat.service';
import { SendMessageDto } from './dtos';

import { SocketEvent } from '@/constants';
import { WsUser } from '@/decorators';
import { WsExceptionFilter } from '@/exceptions';
import { WsAuthGuard, SocketData } from '@/guards';
import { WsLoggingInterceptor } from '@/interceptors';
import type { UserPayload } from '@/modules/auth/auth.service';
import { isDefined } from '@/utils';

// Same namespace as RoomsGateway ('/ws'). NestJS merges multiple gateways on
// the same namespace into one Socket.IO server — each gateway independently
// registers its own @SubscribeMessage handlers on that shared server.
@WebSocketGateway({ namespace: '/ws', cors: { origin: '*' } })
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
    // roomId is stored on client.data by the join/create/rejoin handlers.
    // If it's missing the socket is not in a room and we reject the message.
    const { roomId } = client.data as SocketData;

    if (!isDefined(roomId)) {
      throw new WsException('You are not in a room');
    }

    const message = await this.chatService.addMessage(roomId, {
      userId: user.sub,
      content: dto.content,
    });

    // client.to(roomId) targets every socket in the Socket.IO room EXCEPT
    // the sender. The sender gets the saved message back through the ack
    // return value below, so they don't need to receive the broadcast.
    client.to(roomId).emit(SocketEvent.Chat.MESSAGE, message);

    // Returning the message calls the ack callback on the client side.
    // This confirms the message was persisted and gives the sender the
    // server-assigned id and sentAt timestamp.
    return message;
  }
}
