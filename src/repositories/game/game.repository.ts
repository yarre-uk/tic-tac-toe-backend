import { Injectable } from '@nestjs/common';

import { GameStatus, GameType } from '@/generated/prisma/enums';
import { PrismaService } from '@/libs';
import type { GameResult } from '@/modules/game/types';

export type StoredMove = { userId: string; action: object };

@Injectable()
export class GameRepository {
  constructor(private readonly prisma: PrismaService) {}

  async start(type: GameType, roomId: string): Promise<{ gameId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const game = await tx.game.create({
        data: { type, status: GameStatus.Active },
      });

      await tx.room.update({
        where: { id: roomId },
        data: { currentGameId: game.id },
      });

      return { gameId: game.id };
    });
  }

  async finish(
    gameId: string,
    result: GameResult,
    moves: StoredMove[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.game.update({
        where: { id: gameId },
        data: { status: GameStatus.Finished, result, finishedAt: new Date() },
      }),
      this.prisma.move.createMany({
        data: moves.map((move, i) => ({ ...move, gameId, sequence: i })),
      }),
      this.prisma.room.update({
        where: { currentGameId: gameId },
        data: { currentGameId: null },
      }),
    ]);
  }

  async abandon(gameId: string): Promise<void> {
    await this.prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.Abandoned, finishedAt: new Date() },
    });
  }
}
