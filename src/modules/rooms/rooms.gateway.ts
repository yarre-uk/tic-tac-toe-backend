import { Logger, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { RoomResponseDto } from './dto';
import { CreateRoomDto } from './dto';
import { UpdateRoomDto } from './dto';
import { RoomsService } from './rooms.service';

import { SocketEvent } from '@/constants';
import { WsUser } from '@/decorators';
import { WsExceptionFilter } from '@/exceptions';
import { WsAuthGuard, SocketData } from '@/guards';
import { WsLoggingInterceptor } from '@/interceptors';
import { getEnv } from '@/libs';
import type { UserPayload } from '@/modules/auth/auth.service';
import { isDefined } from '@/utils';

const TIME_BEFORE_AUTO_LEAVE = 60 * 1000;

@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: getEnv('FRONTEND_URL'), credentials: true },
})
@UseFilters(new WsExceptionFilter())
@UseGuards(WsAuthGuard)
@UseInterceptors(new WsLoggingInterceptor())
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;
  private logger = new Logger('RoomsGateway');

  private readonly pendingLeaves = new Map<string, NodeJS.Timeout>();

  constructor(private readonly roomsService: RoomsService) {}

  private cancelPendingLeave(userId: string): void {
    const timer = this.pendingLeaves.get(userId);

    if (isDefined(timer)) {
      clearTimeout(timer);
      this.pendingLeaves.delete(userId);
    }
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    const data = client.data as SocketData;
    if (!isDefined(data.user)) {
      return;
    }

    const { user, roomId } = data;

    const timer = setTimeout(() => {
      this.pendingLeaves.delete(user.sub);

      void this.roomsService
        .leave(user.sub)
        .then((result) => {
          // Notify other users
          if (
            isDefined(result) &&
            isDefined(roomId) &&
            typeof roomId === 'string'
          ) {
            this.server
              .to(roomId)
              .emit(SocketEvent.Rooms.UPDATED, RoomResponseDto.from(result));
          }
        })
        .catch(() => {});
    }, TIME_BEFORE_AUTO_LEAVE);

    this.pendingLeaves.set(user.sub, timer);
  }

  @SubscribeMessage(SocketEvent.Rooms.CREATE)
  async handleCreate(
    @WsUser() user: UserPayload,
    @MessageBody() dto: CreateRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
    this.cancelPendingLeave(user.sub);

    const room = await this.roomsService.create(user.sub, dto);

    await client.join(room.id);
    (client.data as SocketData).roomId = room.id;

    return RoomResponseDto.from(room);
  }

  @SubscribeMessage(SocketEvent.Rooms.JOIN)
  async handleJoin(
    @WsUser() user: UserPayload,
    @MessageBody() body: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.cancelPendingLeave(user.sub);

    const [newRoom, leftRoom] = await this.roomsService.join(
      user.sub,
      body.roomId,
    );

    if (isDefined(leftRoom)) {
      await client.leave(leftRoom.id);

      // Notify the other player in the room. client.to() excludes the sender.
      // Shortened version of server.to(room.id).except(client.id).emit()
      client
        .to(leftRoom.id)
        .emit(SocketEvent.Rooms.UPDATED, RoomResponseDto.from(leftRoom));
    }

    await client.join(newRoom.id);
    (client.data as SocketData).roomId = newRoom.id;

    // Notify the other player in the room. client.to() excludes the sender.
    // Shortened version of server.to(room.id).except(client.id).emit()
    client
      .to(newRoom.id)
      .emit(SocketEvent.Rooms.UPDATED, RoomResponseDto.from(newRoom));

    return RoomResponseDto.from(newRoom);
  }

  @SubscribeMessage(SocketEvent.Rooms.REJOIN)
  async handleRejoin(
    @WsUser() user: UserPayload,
    @MessageBody() body: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.cancelPendingLeave(user.sub);

    const room = await this.roomsService.rejoin(user.sub, body.roomId);

    await client.join(room.id);
    (client.data as SocketData).roomId = room.id;

    client
      .to(room.id)
      .emit(SocketEvent.Rooms.UPDATED, RoomResponseDto.from(room));

    return RoomResponseDto.from(room);
  }

  @SubscribeMessage(SocketEvent.Rooms.LEAVE)
  async handleLeave(
    @WsUser() user: UserPayload,
    @ConnectedSocket() client: Socket,
  ) {
    this.cancelPendingLeave(user.sub);

    // Socket.IO always adds the socket's own id as a room, so filter it out.
    const currentRoomId = [...client.rooms].find((r) => r !== client.id);

    const result = await this.roomsService.leave(user.sub);

    if (isDefined(currentRoomId)) {
      await client.leave(currentRoomId);
      (client.data as SocketData).roomId = undefined;
    }

    if (isDefined(result) && isDefined(currentRoomId)) {
      this.server
        .to(currentRoomId)
        .emit(SocketEvent.Rooms.UPDATED, RoomResponseDto.from(result));
    }

    return { success: true };
  }

  @SubscribeMessage(SocketEvent.Rooms.UPDATE)
  async handleUpdate(
    @WsUser() user: UserPayload,
    @MessageBody() body: { roomId: string; data: UpdateRoomDto },
    @ConnectedSocket() client: Socket,
  ) {
    this.cancelPendingLeave(user.sub);
    const room = await this.roomsService.update(
      user.sub,
      body.roomId,
      body.data,
    );

    // Notify the other player in the room. client.to() excludes the sender.
    // Shortened version of server.to(room.id).except(client.id).emit()
    client
      .to(room.id)
      .emit(SocketEvent.Rooms.UPDATED, RoomResponseDto.from(room));

    return RoomResponseDto.from(room);
  }
}
