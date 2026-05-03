import { Injectable } from '@nestjs/common';

import { Room, User } from '@/generated/prisma/client';
import { RoomStatus } from '@/generated/prisma/enums';
import { PrismaService } from '@/libs';

export type Player = Pick<User, 'id' | 'nickname'>;

export const PlayerQuerySelection = { id: true, nickname: true };

export type RoomWithPlayers = Room & {
  players: Player[];
};

@Injectable()
export class RoomRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<RoomWithPlayers | null> {
    return this.prisma.room.findUnique({
      where: { id },
      include: { players: { select: PlayerQuerySelection } },
    });
  }

  findAll(): Promise<RoomWithPlayers[]> {
    return this.prisma.room.findMany({
      include: { players: { select: PlayerQuerySelection } },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(data: {
    name?: string | null;
    ownerId: string;
    userId: string;
  }): Promise<RoomWithPlayers> {
    return this.prisma.room.create({
      data: {
        name: data.name,
        ownerId: data.ownerId,
        players: { connect: { id: data.userId } },
      },
      include: { players: { select: PlayerQuerySelection } },
    });
  }

  update(
    id: string,
    data: Partial<{ name: string | null; status: RoomStatus; ownerId: string }>,
  ): Promise<RoomWithPlayers> {
    return this.prisma.room.update({
      where: { id },
      data,
      include: { players: { select: PlayerQuerySelection } },
    });
  }

  delete(id: string): Promise<Room> {
    return this.prisma.room.delete({ where: { id } });
  }
}
