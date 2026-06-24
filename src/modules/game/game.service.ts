import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type Redis from 'ioredis';

import { GameEngineRegistry } from './game-engine.registry';
import type { GameResult } from './types';

import { Room } from '@/generated/prisma/client';
import { GameStatus, GameType } from '@/generated/prisma/enums';
import { AppEvents, PrismaService } from '@/libs';
import { REDIS_CLIENT_KEY } from '@/libs/redis/redis.module';
import { isDefined } from '@/utils';

// Redis key helpers — keeps key format in one place
const stateKey = (gameId: string) => `game:${gameId}:state`;
const movesKey = (gameId: string) => `game:${gameId}:moves`;
const metaKey = (gameId: string) => `game:${gameId}:meta`;

type GameMeta = {
  type: GameType;
  playerIds: string[];
};

type GameMove = { userId: string; action: object };

@Injectable()
export class GameService {
  constructor(
    private readonly registry: GameEngineRegistry,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT_KEY) private readonly redis: Redis,
  ) {}

  async startGame(roomId: string, type: GameType, playerIds: [string, string]) {
    const engine = this.registry.get(type);
    const initialState = engine.init(playerIds);

    const { gameId } = await this.prisma.$transaction(async (tx) => {
      const game = await tx.game.create({
        data: {
          status: GameStatus.Active,
          type: type,
        },
      });

      await tx.room.update({
        where: {
          id: roomId,
        },
        data: {
          currentGameId: game.id,
        },
      });

      return { gameId: game.id };
    });

    await this.redis.set(
      stateKey(gameId),
      JSON.stringify(initialState),
      'EX',
      engine.dataTTL,
    );
    await this.redis.set(
      metaKey(gameId),
      JSON.stringify({ type, playerIds } satisfies GameMeta),
      'EX',
      engine.dataTTL,
    );

    return { gameId, state: initialState };
  }

  async makeMove(gameId: string, userId: string, action: object) {
    const stateSerialized = await this.redis.get(stateKey(gameId));

    if (!isDefined(stateSerialized)) {
      throw new NotFoundException('Game not found!');
    }

    const metaSerialized = await this.redis.get(metaKey(gameId));

    if (!isDefined(metaSerialized)) {
      throw new NotFoundException('Game metadata not found!');
    }

    const meta = JSON.parse(metaSerialized) as GameMeta;

    const engine = this.registry.get(meta.type);

    const state = JSON.parse(stateSerialized) as object;

    if (!engine.isValidMove(state, userId, action)) {
      throw new BadRequestException('This move is invalid!');
    }

    const { state: nextState, result } = engine.applyMove(
      state,
      userId,
      action,
    );

    await this.redis.set(
      stateKey(gameId),
      JSON.stringify(nextState),
      'EX',
      engine.dataTTL,
    );
    await this.redis.expire(metaKey(gameId), engine.dataTTL);

    await this.redis.rpush(
      movesKey(gameId),
      JSON.stringify({ userId, action } satisfies GameMove),
      engine.dataTTL,
    );

    if (isDefined(result)) {
      await this.endGame(gameId, result);
    }

    return { state: nextState, result };
  }

  async endGame(gameId: string, result: GameResult) {
    const movesSerialized = await this.redis.lrange(movesKey(gameId), 0, -1);
    const moves = movesSerialized.map((r) => JSON.parse(r) as GameMove);

    await this.prisma.$transaction([
      this.prisma.game.update({
        where: {
          id: gameId,
        },
        data: {
          status: GameStatus.Finished,
          result: result,
          finishedAt: new Date(),
        },
      }),
      this.prisma.move.createMany({
        data: moves.map((move, i) => ({
          ...move,
          gameId,
          sequence: i,
        })),
      }),
      this.prisma.room.update({
        where: {
          currentGameId: gameId,
        },
        data: {
          currentGameId: null,
        },
      }),
    ]);

    await this.redis.del(stateKey(gameId), movesKey(gameId), metaKey(gameId));
  }

  async abandonGame(gameId: string) {
    return this.prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.Abandoned, finishedAt: new Date() },
    });
  }

  async getState(gameId: string) {
    const stateSerialized = await this.redis.get(stateKey(gameId));

    if (!isDefined(stateSerialized)) {
      await this.abandonGame(gameId);

      throw new NotFoundException(
        'Game state expired and could not be recovered',
      );
    }

    const movesSerialized = await this.redis.lrange(movesKey(gameId), 0, -1);

    if (!isDefined(movesSerialized)) {
      throw new NotFoundException('Game moves could not be found');
    }

    const moves = movesSerialized.map((r) => JSON.parse(r) as GameMove);

    const state = JSON.parse(stateSerialized) as object;

    return { state, moves };
  }

  @OnEvent(AppEvents.ROOM_DELETED)
  async onRoomDeleted(payload: { roomId: string; room: Room }): Promise<void> {
    const gameId = payload.room.currentGameId;

    if (isDefined(gameId)) {
      await this.abandonGame(gameId);
    }
  }
}
