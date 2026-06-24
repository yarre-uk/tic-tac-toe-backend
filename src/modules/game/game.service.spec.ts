import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { GameEngineRegistry } from './game-engine.registry';
import { GameService } from './game.service';

import { GameType } from '@/generated/prisma/enums';
import { AppEvents } from '@/libs';
import { REDIS_CLIENT_KEY } from '@/libs/redis/redis.module';
import { GameRepository } from '@/repositories';

// ─── Constants ────────────────────────────────────────────────────────────────

const GAME_ID = 'game-id-123';
const ROOM_ID = 'room-id-456';
const PLAYER_X = 'player-x-id';
const PLAYER_O = 'player-o-id';
const PLAYER_IDS: [string, string] = [PLAYER_X, PLAYER_O];

const INITIAL_STATE = {
  board: Array(9).fill(null) as null[],
  currentPlayerId: PLAYER_X,
  playerIds: PLAYER_IDS,
};

const NEXT_STATE = {
  ...INITIAL_STATE,
  board: [PLAYER_X, ...Array(8).fill(null)] as (string | null)[],
  currentPlayerId: PLAYER_O,
};

const GAME_META = JSON.stringify({ type: GameType.TTT, playerIds: PLAYER_IDS });
const GAME_TYPE = GameType.TTT;

// ─── Shared mocks ─────────────────────────────────────────────────────────────

let mockEngine: {
  type: GameType;
  dataTTL: number;
  init: jest.Mock;
  isValidMove: jest.Mock;
  applyMove: jest.Mock;
};

let mockRegistry: { get: jest.Mock };
let mockGameRepo: { start: jest.Mock; finish: jest.Mock; abandon: jest.Mock };
let mockRedis: {
  get: jest.Mock;
  set: jest.Mock;
  expire: jest.Mock;
  rpush: jest.Mock;
  lrange: jest.Mock;
  del: jest.Mock;
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('GameService', () => {
  let service: GameService;

  beforeEach(async () => {
    mockEngine = {
      type: GAME_TYPE,
      dataTTL: 3600,
      init: jest.fn().mockReturnValue(INITIAL_STATE),
      isValidMove: jest.fn().mockReturnValue(true),
      applyMove: jest.fn().mockReturnValue({ state: NEXT_STATE, result: null }),
    };

    mockRegistry = { get: jest.fn().mockReturnValue(mockEngine) };

    mockGameRepo = {
      start: jest.fn().mockResolvedValue({ gameId: GAME_ID }),
      finish: jest.fn().mockResolvedValue(undefined),
      abandon: jest.fn().mockResolvedValue(undefined),
    };

    mockRedis = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
      expire: jest.fn().mockResolvedValue(1),
      rpush: jest.fn().mockResolvedValue(1),
      lrange: jest.fn().mockResolvedValue([]),
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        { provide: GameEngineRegistry, useValue: mockRegistry },
        { provide: GameRepository, useValue: mockGameRepo },
        { provide: REDIS_CLIENT_KEY, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
  });

  // ─── startGame ────────────────────────────────────────────────────────────

  describe('startGame', () => {
    it('should initialise state from the engine and store it in Redis', async () => {
      await service.startGame(ROOM_ID, GAME_TYPE, PLAYER_IDS);

      expect(mockEngine.init).toHaveBeenCalledWith(PLAYER_IDS);
      expect(mockRedis.set).toHaveBeenCalledWith(
        `game:${GAME_ID}:state`,
        JSON.stringify(INITIAL_STATE),
        'EX',
        mockEngine.dataTTL,
      );
    });

    it('should store game meta with playerIds in Redis', async () => {
      await service.startGame(ROOM_ID, GAME_TYPE, PLAYER_IDS);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `game:${GAME_ID}:meta`,
        GAME_META,
        'EX',
        mockEngine.dataTTL,
      );
    });

    it('should call repository.start with the correct type and roomId', async () => {
      await service.startGame(ROOM_ID, GAME_TYPE, PLAYER_IDS);

      expect(mockGameRepo.start).toHaveBeenCalledWith(GAME_TYPE, ROOM_ID);
    });

    it('should return the gameId and initial state', async () => {
      const result = await service.startGame(ROOM_ID, GAME_TYPE, PLAYER_IDS);

      expect(result).toEqual({ gameId: GAME_ID, state: INITIAL_STATE });
    });
  });

  // ─── makeMove ─────────────────────────────────────────────────────────────

  describe('makeMove', () => {
    const action = { cellId: 0 };

    beforeEach(() => {
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(INITIAL_STATE)) // state key
        .mockResolvedValueOnce(GAME_META); // meta key
    });

    it('should throw NotFoundException when state is not in Redis', async () => {
      mockRedis.get.mockReset().mockResolvedValue(null);

      await expect(
        service.makeMove(GAME_ID, PLAYER_X, action),
      ).rejects.toThrow(new NotFoundException('Game not found!'));
    });

    it('should throw NotFoundException when meta is not in Redis', async () => {
      mockRedis.get
        .mockReset()
        .mockResolvedValueOnce(JSON.stringify(INITIAL_STATE))
        .mockResolvedValueOnce(null);

      await expect(
        service.makeMove(GAME_ID, PLAYER_X, action),
      ).rejects.toThrow(new NotFoundException('Game metadata not found!'));
    });

    it('should throw BadRequestException when the move is invalid', async () => {
      mockEngine.isValidMove.mockReturnValue(false);

      await expect(
        service.makeMove(GAME_ID, PLAYER_X, action),
      ).rejects.toThrow(new BadRequestException('This move is invalid!'));
    });

    it('should save the new state to Redis after a valid move', async () => {
      await service.makeMove(GAME_ID, PLAYER_X, action);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `game:${GAME_ID}:state`,
        JSON.stringify(NEXT_STATE),
        'EX',
        mockEngine.dataTTL,
      );
    });

    it('should refresh the meta TTL on every move', async () => {
      await service.makeMove(GAME_ID, PLAYER_X, action);

      expect(mockRedis.expire).toHaveBeenCalledWith(
        `game:${GAME_ID}:meta`,
        mockEngine.dataTTL,
      );
    });

    it('should append the move to the Redis buffer', async () => {
      await service.makeMove(GAME_ID, PLAYER_X, action);

      expect(mockRedis.rpush).toHaveBeenCalledWith(
        `game:${GAME_ID}:moves`,
        JSON.stringify({ userId: PLAYER_X, action }),
      );
    });

    it('should return the next state and null result when game is ongoing', async () => {
      const result = await service.makeMove(GAME_ID, PLAYER_X, action);

      expect(result).toEqual({ state: NEXT_STATE, result: null });
    });

    it('should call endGame when the move produces a result', async () => {
      const gameResult = { winner: PLAYER_X, isDraw: false };
      mockEngine.applyMove.mockReturnValue({
        state: NEXT_STATE,
        result: gameResult,
      });

      await service.makeMove(GAME_ID, PLAYER_X, action);

      expect(mockGameRepo.finish).toHaveBeenCalledWith(
        GAME_ID,
        gameResult,
        expect.any(Array),
      );
    });

    it('should not call endGame when result is null', async () => {
      await service.makeMove(GAME_ID, PLAYER_X, action);

      expect(mockGameRepo.finish).not.toHaveBeenCalled();
    });
  });

  // ─── endGame ──────────────────────────────────────────────────────────────

  describe('endGame', () => {
    const result = { winner: PLAYER_X, isDraw: false };
    const rawMoves = [
      JSON.stringify({ userId: PLAYER_X, action: { cellId: 0 } }),
      JSON.stringify({ userId: PLAYER_O, action: { cellId: 1 } }),
    ];

    beforeEach(() => {
      mockRedis.lrange.mockResolvedValue(rawMoves);
    });

    it('should batch-insert all buffered moves via the repository', async () => {
      await service.endGame(GAME_ID, result);

      expect(mockGameRepo.finish).toHaveBeenCalledWith(GAME_ID, result, [
        { userId: PLAYER_X, action: { cellId: 0 } },
        { userId: PLAYER_O, action: { cellId: 1 } },
      ]);
    });

    it('should delete all three Redis keys after persisting', async () => {
      await service.endGame(GAME_ID, result);

      expect(mockRedis.del).toHaveBeenCalledWith(
        `game:${GAME_ID}:state`,
        `game:${GAME_ID}:moves`,
        `game:${GAME_ID}:meta`,
      );
    });
  });

  // ─── abandonGame ──────────────────────────────────────────────────────────

  describe('abandonGame', () => {
    it('should call repository.abandon with the gameId', async () => {
      await service.abandonGame(GAME_ID);

      expect(mockGameRepo.abandon).toHaveBeenCalledWith(GAME_ID);
    });

    it('should clean up all Redis keys', async () => {
      await service.abandonGame(GAME_ID);

      expect(mockRedis.del).toHaveBeenCalledWith(
        `game:${GAME_ID}:state`,
        `game:${GAME_ID}:moves`,
        `game:${GAME_ID}:meta`,
      );
    });
  });

  // ─── getState ─────────────────────────────────────────────────────────────

  describe('getState', () => {
    it('should return the state and moves when state exists in Redis', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(INITIAL_STATE));
      mockRedis.lrange.mockResolvedValue([]);

      const result = await service.getState(GAME_ID);

      expect(result).toEqual({ state: INITIAL_STATE, moves: [] });
    });

    it('should call abandonGame and throw NotFoundException when state is missing', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.getState(GAME_ID)).rejects.toThrow(
        new NotFoundException('Game state expired and could not be recovered'),
      );
      expect(mockGameRepo.abandon).toHaveBeenCalledWith(GAME_ID);
    });
  });

  // ─── onRoomDeleted ────────────────────────────────────────────────────────

  describe('onRoomDeleted', () => {
    it('should abandon the game when the room had an active game', async () => {
      await service.onRoomDeleted({
        roomId: ROOM_ID,
        room: { currentGameId: GAME_ID } as never,
      });

      expect(mockGameRepo.abandon).toHaveBeenCalledWith(GAME_ID);
    });

    it('should do nothing when the room had no active game', async () => {
      await service.onRoomDeleted({
        roomId: ROOM_ID,
        room: { currentGameId: null } as never,
      });

      expect(mockGameRepo.abandon).not.toHaveBeenCalled();
    });

  });
});
