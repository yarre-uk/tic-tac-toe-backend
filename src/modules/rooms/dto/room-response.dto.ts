import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { RoomStatus } from '@/generated/prisma/enums';
import { RoomWithPlayers } from '@/repositories';

class RoomPlayerDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  nickname!: string;
}

export class RoomResponseDto {
  @ApiProperty({ example: '01912a3b-7c8d-7e9f-a0b1-c2d3e4f50678' })
  id: string;

  @ApiPropertyOptional({ example: 'my-room', nullable: true })
  name: string | null;

  @ApiProperty({ enum: RoomStatus, enumName: 'RoomStatus' })
  status: RoomStatus;

  @ApiProperty({ example: '01912a3b-7c8d-7e9f-a0b1-c2d3e4f50678' })
  ownerId: string;

  @ApiProperty({ type: [RoomPlayerDto] })
  players: RoomPlayerDto[];

  @ApiProperty()
  createdAt: Date;

  private constructor(room: RoomWithPlayers) {
    this.id = room.id;
    this.name = room.name;
    this.status = room.status;
    this.ownerId = room.ownerId;
    this.players = room.players;
    this.createdAt = room.createdAt;
  }

  static from(room: RoomWithPlayers): RoomResponseDto {
    return new RoomResponseDto(room);
  }

  static fromList(rooms: RoomWithPlayers[]): RoomResponseDto[] {
    return rooms.map((r) => RoomResponseDto.from(r));
  }
}
