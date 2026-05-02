import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsAuthGuard, SocketData } from '@/guards';
import { WsUser } from '@/decorators';
import type { UserPayload } from '@/modules/auth/auth.service';
import { RoomsService } from './rooms.service';
import { RoomResponseDto } from './dto';
import { CreateRoomDto } from './dto';
import { UpdateRoomDto } from './dto';
import { isDefined } from '@/utils';

const TIME_BEFORE_AUTO_LEAVE = 60 * 1000;

// TODO restrict to frontend domain
@WebSocketGateway({ namespace: '/ws', cors: { origin: '*' } })
@UseGuards(WsAuthGuard)
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

    const user = (client.data as SocketData).user;
    if (!isDefined(user)) {
      return;
    }

    // Socket.IO always adds the socket's own id as a room, so filter it out.
    const roomId = [...client.rooms].find((room) => room !== client.id);

    const timer = setTimeout(() => {
      this.pendingLeaves.delete(user.sub);

      void this.roomsService
        .leave(user.sub)
        .then((result) => {
          if (isDefined(result) && isDefined(roomId)) {
            this.server
              .to(roomId)
              .emit('room:updated', RoomResponseDto.from(result));
          }
        })
        .catch(() => {});
    }, TIME_BEFORE_AUTO_LEAVE);

    this.pendingLeaves.set(user.sub, timer);
  }

  @SubscribeMessage('room:create')
  async handleCreate(
    @WsUser() user: UserPayload,
    @MessageBody() dto: CreateRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
    this.cancelPendingLeave(user.sub);

    const room = await this.roomsService.create(user.sub, dto);

    await client.join(room.id);

    return { event: 'room:created', data: RoomResponseDto.from(room) };
  }

  @SubscribeMessage('room:join')
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
        .emit('room:updated', RoomResponseDto.from(leftRoom));
    }

    await client.join(newRoom.id);

    // Notify the other player in the room. client.to() excludes the sender.
    // Shortened version of server.to(room.id).except(client.id).emit()
    client.to(newRoom.id).emit('room:updated', RoomResponseDto.from(newRoom));

    return { event: 'room:joined', data: RoomResponseDto.from(newRoom) };
  }

  @SubscribeMessage('room:leave')
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
    }

    if (isDefined(result) && isDefined(currentRoomId)) {
      this.server
        .to(currentRoomId)
        .emit('room:updated', RoomResponseDto.from(result));
    }

    return { event: 'room:left' };
  }

  @SubscribeMessage('room:update')
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
    client.to(room.id).emit('room:updated', RoomResponseDto.from(room));

    return { event: 'room:updated', data: RoomResponseDto.from(room) };
  }
}
