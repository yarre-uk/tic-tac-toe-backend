import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsAuthGuard, SocketData } from '@/guards';
import { WsUser } from '@/decorators';
import type { UserPayload } from '@/modules/auth/auth.service';
import { RoomsService } from './rooms.service';
import { RoomResponseDto } from './dto';
import { CreateRoomDto } from './dto';
import { UpdateRoomDto } from './dto';

// @WebSocketGateway spins up a Socket.IO server alongside the existing HTTP server.
//
// namespace: '/rooms' — all events in this gateway are scoped to this path.
// Clients connect with:
//   const socket = io('http://localhost:3000/rooms', { auth: { token: 'Bearer ...' } })
//
// Without a namespace you'd use the default '/' namespace, which works but mixes
// all your gateways together. Namespacing keeps concerns separate.
//
// cors.origin: '*' — allow any origin during development. In production restrict this
// to your actual frontend domain.
@WebSocketGateway({ namespace: '/rooms', cors: { origin: '*' } })
// @UseGuards at the class level applies WsAuthGuard to every @SubscribeMessage handler
// defined below. It does NOT apply to handleConnection / handleDisconnect — those are
// lifecycle hooks, not message handlers, and guards don't intercept them.
@UseGuards(WsAuthGuard)
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  // @WebSocketServer injects the Socket.IO Server instance for this namespace.
  // We use it to broadcast events to all sockets in a given Socket.IO room channel,
  // not just the sender.
  @WebSocketServer()
  server!: Server;

  constructor(private readonly roomsService: RoomsService) {}

  // Called automatically the moment any client opens a WebSocket connection.
  // At this point no guard has run yet — we don't know who the user is.
  // We allow the connection to proceed; unauthenticated clients simply cannot
  // trigger any @SubscribeMessage handler because WsAuthGuard will block them.
  handleConnection(client: Socket) {
    console.log(`[RoomsGateway] Client connected: ${client.id}`);
  }

  // Called automatically when a client disconnects — intentionally (client calls
  // socket.disconnect()) or unintentionally (tab close, network drop, process crash).
  //
  // This is the right place to do cleanup so a crashed client doesn't leave a ghost
  // player stuck in a room forever.
  async handleDisconnect(client: Socket) {
    console.log(`[RoomsGateway] Client disconnected: ${client.id}`);

    // client.data.user is written by WsAuthGuard the first time the client sends an
    // authenticated message. If the client disconnected without ever authenticating,
    // client.data.user is undefined and there's nothing to clean up.
    const user = (client.data as SocketData).user;
    if (!user) {
      return;
    }

    try {
      const result = await this.roomsService.leave(user.sub);

      // leave() returns the updated room if it still exists (other player is still there),
      // or null/void if the room was deleted (user was the last player).
      // If the room still has a player, tell them the room went back to Waiting.
      // leave() returns null when the room was deleted (user was the last player).
      // Only broadcast when the room still exists and has a remaining player.
      if (result) {
        this.server
          .to(result.id)
          .emit('room:updated', RoomResponseDto.from(result));
      }
    } catch {
      // leave() throws BadRequestException when the user wasn't in any room.
      // That's perfectly normal on disconnect — swallow it.
    }
  }

  // ─── Event handlers ──────────────────────────────────────────────────────────
  //
  // Each @SubscribeMessage('event:name') method handles one client → server event.
  //
  // The return value is sent back ONLY to the sender as an acknowledgment.
  // This is Socket.IO's "ack" mechanism — the client can pass a callback as the
  // last argument to socket.emit() and it will receive the return value:
  //
  //   socket.emit('room:create', { name: 'my-room' }, (response) => {
  //     console.log(response); // { event: 'room:created', data: { id: '...', ... } }
  //   })
  //
  // To broadcast to multiple clients, use this.server.to(roomId).emit(...) instead.
  // ─────────────────────────────────────────────────────────────────────────────

  // room:create — player wants to open a new room.
  //
  // After creation the creator is placed in the Socket.IO room channel so they
  // receive future broadcasts (opponent joining, room updates, etc.).
  @SubscribeMessage('room:create')
  async handleCreate(
    // @WsUser() reads client.data.user that WsAuthGuard wrote — same idea as
    // @User() in HTTP controllers but adapted for WebSocket context.
    @WsUser() user: UserPayload,
    // @MessageBody() deserialises the payload the client sent with the event.
    @MessageBody() dto: CreateRoomDto,
    // @ConnectedSocket() gives us the raw Socket instance so we can call
    // socket-level methods like client.join() to subscribe to a channel.
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.roomsService.create(user.sub, dto);

    // Join the Socket.IO room channel named after the Postgres room ID.
    // From this point on, this.server.to(room.id).emit(...) will reach this client.
    await client.join(room.id);

    // Return the new room to the creator as an ack.
    return { event: 'room:created', data: RoomResponseDto.from(room) };
  }

  // room:join — player wants to enter an existing room.
  //
  // If the player is already in another room, RoomsService.join() automatically
  // leaves it first (the auto-leave logic lives in the service layer, not here).
  // After joining we broadcast to everyone in the room so the waiting player knows
  // their opponent arrived.
  @SubscribeMessage('room:join')
  async handleJoin(
    @WsUser() user: UserPayload,
    // The client sends just the room ID: socket.emit('room:join', { roomId: '...' })
    @MessageBody() body: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.roomsService.join(user.sub, body.roomId);

    // Subscribe this socket to the room's broadcast channel.
    await client.join(room.id);

    // Broadcast the updated room to ALL sockets in the channel — both the joiner
    // and the player who was already waiting see the same 'room:updated' event.
    // this.server.to(id) targets every socket in that Socket.IO room, including sender.
    this.server.to(room.id).emit('room:updated', RoomResponseDto.from(room));

    // Still send an ack back to the joiner so they know the operation succeeded.
    return { event: 'room:joined', data: RoomResponseDto.from(room) };
  }

  // room:leave — player voluntarily leaves their current room.
  //
  // If they were the owner and another player is present, ownership is transferred.
  // If they were the last player, the room is deleted.
  @SubscribeMessage('room:leave')
  async handleLeave(
    @WsUser() user: UserPayload,
    @ConnectedSocket() client: Socket,
  ) {
    // We capture the roomId before leaving because the service may delete the room,
    // making it impossible to know which Socket.IO channel to unsubscribe from later.
    // We read it from the socket's current rooms set (the client joined it on create/join).
    // Socket.IO always adds the socket's own id as a room, so filter it out.
    const currentRoomId = [...client.rooms].find((r) => r !== client.id);

    const result = await this.roomsService.leave(user.sub);

    // Unsubscribe from the channel so this client no longer receives broadcasts.
    if (currentRoomId) {
      await client.leave(currentRoomId);
    }

    if (result && currentRoomId) {
      // The room still exists — notify the remaining player that it's now Waiting.
      this.server
        .to(currentRoomId)
        .emit('room:updated', RoomResponseDto.from(result));
    }

    return { event: 'room:left' };
  }

  // room:update — room owner changes the room name.
  //
  // Only the owner can do this (enforced in RoomsService.update).
  // Broadcast the change to everyone in the room.
  @SubscribeMessage('room:update')
  async handleUpdate(
    @WsUser() user: UserPayload,
    @MessageBody() body: { roomId: string; data: UpdateRoomDto },
  ) {
    const room = await this.roomsService.update(
      user.sub,
      body.roomId,
      body.data,
    );

    // Broadcast to all sockets in the room channel, including the owner.
    this.server.to(room.id).emit('room:updated', RoomResponseDto.from(room));

    return { event: 'room:updated', data: RoomResponseDto.from(room) };
  }
}
