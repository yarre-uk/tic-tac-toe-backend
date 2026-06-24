import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreateRoomDto, UpdateRoomDto } from './dto';

import { Prisma } from '@/generated/prisma/client';
import { RoomStatus } from '@/generated/prisma/enums';
import { PrismaService } from '@/libs';
import { AppEvents, TypedEventEmitter } from '@/libs';
import {
  PlayerQuerySelection,
  RoomRepository,
  RoomWithPlayers,
  UserRepository,
} from '@/repositories';
import { isDefined } from '@/utils';

const MAX_PLAYERS = 2;

@Injectable()
export class RoomsService {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly userRepository: UserRepository,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: TypedEventEmitter,
  ) {}

  findAll() {
    return this.roomRepository.findAll();
  }

  async findOne(id: string) {
    const room = await this.roomRepository.findById(id);

    if (!isDefined(room)) {
      throw new NotFoundException(`Room ${id} not found`);
    }

    return room;
  }

  async create(userId: string, dto: CreateRoomDto) {
    const user = await this.userRepository.findById(userId);

    if (isDefined(user?.roomId)) {
      throw new BadRequestException('You are already in a room');
    }

    return this.roomRepository.create({
      name: dto.name,
      ownerId: userId,
      userId,
    });
  }

  async join(
    userId: string,
    roomId: string,
  ): Promise<[RoomWithPlayers, RoomWithPlayers | null]> {
    const room = await this.findOne(roomId);

    if (room.players.some((p) => p.id === userId)) {
      throw new BadRequestException('You are already in this room');
    }

    if (room.status === RoomStatus.Playing) {
      throw new BadRequestException('Room is already full');
    }

    const user = await this.userRepository.findById(userId);

    return this.prisma.$transaction(async (tx) => {
      let leftRoom: RoomWithPlayers | null = null;

      if (isDefined(user?.roomId)) {
        leftRoom = await this.leaveRoom(userId, user.roomId, tx);
      }

      const updatedRoom = await tx.room.update({
        where: { id: roomId },
        data: {
          players: { connect: { id: userId } },
          ...(room.players.length + 1 >= MAX_PLAYERS && {
            status: RoomStatus.Playing,
          }),
        },
        include: { players: { select: PlayerQuerySelection } },
      });

      return [updatedRoom, leftRoom];
    });
  }

  async rejoin(userId: string, roomId: string): Promise<RoomWithPlayers> {
    const room = await this.findOne(roomId);

    if (!room.players.some((p) => p.id === userId)) {
      throw new BadRequestException('You are not a member of this room');
    }

    return room;
  }

  async inRoom(userId: string, roomId: string): Promise<void> {
    const room = await this.findOne(roomId);

    if (!room.players.some((p) => p.id === userId)) {
      throw new ForbiddenException('You are not a member of this room');
    }
  }

  async leave(userId: string) {
    const user = await this.userRepository.findById(userId);

    if (!isDefined(user?.roomId)) {
      throw new BadRequestException('You are not in a room');
    }

    const roomId = user.roomId;
    let currentGameId: string | null = null;

    const result = await this.prisma.$transaction(async (tx) => {
      const room = await tx.room.findFirst({
        where: {
          id: roomId,
        },
        select: {
          currentGameId: true,
        },
      });

      if (isDefined(room?.currentGameId)) {
        currentGameId = room?.currentGameId;
      }

      return this.leaveRoom(userId, roomId, tx);
    });

    // leaveRoom returns null when the last player left and the room was deleted.
    // Only then do we clean up Redis — we don't want to wipe chat while someone
    // is still in the room. Redis is outside the Prisma transaction so we delete
    // after the DB commit confirms the room is gone.
    if (!isDefined(result)) {
      this.eventEmitter.emit(AppEvents.ROOM_DELETED, {
        roomId,
        currentGameId,
      });
    }

    return result;
  }

  async update(userId: string, roomId: string, dto: UpdateRoomDto) {
    const room = await this.findOne(roomId);

    if (room.ownerId !== userId) {
      throw new ForbiddenException('Only the room owner can update it');
    }

    return this.roomRepository.update(roomId, { name: dto.name });
  }

  private async leaveRoom(
    userId: string,
    roomId: string,
    tx: Prisma.TransactionClient,
  ) {
    const room = await tx.room.findUnique({
      where: { id: roomId },
      include: { players: { select: PlayerQuerySelection } },
    });

    if (!isDefined(room)) {
      return null;
    }

    const remaining = room.players.filter((p) => p.id !== userId);

    if (remaining.length === 0) {
      await tx.room.delete({ where: { id: roomId } });
      return null;
    }

    return tx.room.update({
      where: { id: roomId },
      data: {
        players: { disconnect: { id: userId } },
        status: RoomStatus.Waiting,
        ...(room.ownerId === userId && { ownerId: remaining[0].id }),
      },
      include: { players: { select: PlayerQuerySelection } },
    });
  }
}
