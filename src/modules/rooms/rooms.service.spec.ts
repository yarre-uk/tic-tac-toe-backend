import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { RoomsService } from './rooms.service';

import { RoomStatus } from '@/generated/prisma/enums';
import { PrismaService } from '@/libs';
import { RoomRepository } from '@/repositories';

// ─── Constants ────────────────────────────────────────────────────────────────

const OWNER_ID = 'user-owner-id';
const PLAYER_ID = 'user-player-id';
const ROOM_ID = 'room-id-123';
const OLD_ROOM_ID = 'room-id-old';

const ownerPlayer = { id: OWNER_ID, nickname: 'owner' };
const secondPlayer = { id: PLAYER_ID, nickname: 'player2' };

const waitingRoom = {
  id: ROOM_ID,
  name: 'test-room',
  status: RoomStatus.Waiting,
  ownerId: OWNER_ID,
  players: [ownerPlayer],
  createdAt: new Date(),
};

const fullRoom = {
  ...waitingRoom,
  status: RoomStatus.Playing,
  players: [ownerPlayer, secondPlayer],
};

// ─── Shared mocks ─────────────────────────────────────────────────────────────

let mockRepo: {
  findAll: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

let mockTx: {
  room: {
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

let mockPrisma: {
  user: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('RoomsService', () => {
  let service: RoomsService;

  beforeEach(async () => {
    mockRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockTx = {
      room: {
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    mockPrisma = {
      user: { findUnique: jest.fn() },
      $transaction: jest
        .fn()
        .mockImplementation((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: RoomRepository, useValue: mockRepo },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all rooms from the repository', async () => {
      mockRepo.findAll.mockResolvedValue([waitingRoom]);

      await expect(service.findAll()).resolves.toEqual([waitingRoom]);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return the room when found', async () => {
      mockRepo.findById.mockResolvedValue(waitingRoom);

      await expect(service.findOne(ROOM_ID)).resolves.toEqual(waitingRoom);
    });

    it('should throw NotFoundException when the room does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.findOne(ROOM_ID)).rejects.toThrow(
        new NotFoundException(`Room ${ROOM_ID} not found`),
      );
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a room and return it', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: OWNER_ID,
        roomId: null,
      });
      mockRepo.create.mockResolvedValue(waitingRoom);

      const result = await service.create(OWNER_ID, { name: 'test-room' });

      expect(mockRepo.create).toHaveBeenCalledWith({
        name: 'test-room',
        ownerId: OWNER_ID,
        userId: OWNER_ID,
      });
      expect(result).toEqual(waitingRoom);
    });

    it('should throw BadRequestException when user is already in a room', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: OWNER_ID,
        roomId: ROOM_ID,
      });

      await expect(service.create(OWNER_ID, {})).rejects.toThrow(
        new BadRequestException('You are already in a room'),
      );
      expect(mockRepo.create).not.toHaveBeenCalled();
    });
  });

  // ─── join ─────────────────────────────────────────────────────────────────

  describe('join', () => {
    it('should throw BadRequestException when user is already in this room', async () => {
      mockRepo.findById.mockResolvedValue(waitingRoom); // owner is in the room

      await expect(service.join(OWNER_ID, ROOM_ID)).rejects.toThrow(
        new BadRequestException('You are already in this room'),
      );
    });

    it('should throw BadRequestException when the room is full', async () => {
      mockRepo.findById.mockResolvedValue(fullRoom);
      const outsiderId = 'user-outsider-id';

      await expect(service.join(outsiderId, ROOM_ID)).rejects.toThrow(
        new BadRequestException('Room is already full'),
      );
    });

    it('should join the room and keep status Waiting when still one player short', async () => {
      // room has 0 players, joining makes 1 — still Waiting
      const emptyWaiting = { ...waitingRoom, players: [] };
      mockRepo.findById.mockResolvedValue(emptyWaiting);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: OWNER_ID,
        roomId: null,
      });

      const joined = { ...emptyWaiting, players: [ownerPlayer] };
      mockTx.room.update.mockResolvedValue(joined);

      const [result, leftRoom] = await service.join(OWNER_ID, ROOM_ID);

      const [[firstCall]] = mockTx.room.update.mock.calls as [
        { data: { status?: unknown } },
      ][];
      expect(firstCall.data.status).toBeUndefined();
      expect(result).toEqual(joined);
      expect(leftRoom).toBeNull();
    });

    it('should set status to Playing when the room reaches MAX_PLAYERS', async () => {
      // room currently has 1 player; joining fills it
      mockRepo.findById.mockResolvedValue(waitingRoom); // 1 player
      mockPrisma.user.findUnique.mockResolvedValue({
        id: PLAYER_ID,
        roomId: null,
      });

      const joined = {
        ...waitingRoom,
        status: RoomStatus.Playing,
        players: [ownerPlayer, secondPlayer],
      };
      mockTx.room.update.mockResolvedValue(joined);

      const [result, leftRoom] = await service.join(PLAYER_ID, ROOM_ID);

      const [[joinCall]] = mockTx.room.update.mock.calls as [
        { data: { status?: RoomStatus } },
      ][];
      expect(joinCall.data.status).toBe(RoomStatus.Playing);
      expect(result).toEqual(joined);
      expect(leftRoom).toBeNull();
    });

    it('should leave old room first when user is already in one', async () => {
      mockRepo.findById.mockResolvedValue(waitingRoom);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: PLAYER_ID,
        roomId: OLD_ROOM_ID,
      });

      mockTx.room.findUnique.mockResolvedValue({
        ...waitingRoom,
        id: OLD_ROOM_ID,
        ownerId: OWNER_ID,
        players: [secondPlayer, ownerPlayer],
      });

      const updatedOldRoom = {
        ...waitingRoom,
        id: OLD_ROOM_ID,
        players: [secondPlayer],
        status: RoomStatus.Waiting,
      };
      const updatedNewRoom = {
        ...waitingRoom,
        players: [ownerPlayer, secondPlayer],
      };
      mockTx.room.update
        .mockResolvedValueOnce(updatedOldRoom)
        .mockResolvedValueOnce(updatedNewRoom);

      const [newRoom, leftRoom] = await service.join(PLAYER_ID, ROOM_ID);

      const [[findCall]] = mockTx.room.findUnique.mock.calls as [
        { where: { id: string } },
      ][];
      expect(findCall.where.id).toBe(OLD_ROOM_ID);
      expect(leftRoom).toEqual(updatedOldRoom);
      expect(newRoom).toEqual(updatedNewRoom);
    });
  });

  // ─── leave ────────────────────────────────────────────────────────────────

  describe('leave', () => {
    it('should throw BadRequestException when user is not in any room', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: OWNER_ID,
        roomId: null,
      });

      await expect(service.leave(OWNER_ID)).rejects.toThrow(
        new BadRequestException('You are not in a room'),
      );
    });

    it('should delete the room when the leaving user is the last player', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: OWNER_ID,
        roomId: ROOM_ID,
      });
      mockTx.room.findUnique.mockResolvedValue({
        ...waitingRoom,
        players: [ownerPlayer], // only the owner
      });
      mockTx.room.delete.mockResolvedValue(waitingRoom);

      await service.leave(OWNER_ID);

      expect(mockTx.room.delete).toHaveBeenCalledWith({
        where: { id: ROOM_ID },
      });
      expect(mockTx.room.update).not.toHaveBeenCalled();
    });

    it('should transfer ownership when the owner leaves and another player remains', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: OWNER_ID,
        roomId: ROOM_ID,
      });
      mockTx.room.findUnique.mockResolvedValue({
        ...waitingRoom,
        players: [ownerPlayer, secondPlayer],
      });
      mockTx.room.update.mockResolvedValue({
        ...waitingRoom,
        ownerId: PLAYER_ID,
        players: [secondPlayer],
      });

      await service.leave(OWNER_ID);

      const [[leaveCall]] = mockTx.room.update.mock.calls as [
        { data: { ownerId?: string; status?: RoomStatus } },
      ][];
      expect(leaveCall.data.ownerId).toBe(PLAYER_ID);
      expect(leaveCall.data.status).toBe(RoomStatus.Waiting);
    });

    it('should not change ownership when a non-owner player leaves', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: PLAYER_ID,
        roomId: ROOM_ID,
      });
      mockTx.room.findUnique.mockResolvedValue({
        ...waitingRoom,
        ownerId: OWNER_ID,
        players: [ownerPlayer, secondPlayer],
      });
      mockTx.room.update.mockResolvedValue({
        ...waitingRoom,
        players: [ownerPlayer],
      });

      await service.leave(PLAYER_ID);

      const [[callArgs]] = mockTx.room.update.mock.calls as [
        { data: { ownerId?: unknown } },
      ][];
      expect(callArgs.data.ownerId).toBeUndefined();
    });

    it('should return null when the room no longer exists at transaction time', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: OWNER_ID,
        roomId: ROOM_ID,
      });
      mockTx.room.findUnique.mockResolvedValue(null);

      await expect(service.leave(OWNER_ID)).resolves.toBeNull();
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update the room name when called by the owner', async () => {
      mockRepo.findById.mockResolvedValue(waitingRoom);
      const updated = { ...waitingRoom, name: 'new-name' };
      mockRepo.update.mockResolvedValue(updated);

      const result = await service.update(OWNER_ID, ROOM_ID, {
        name: 'new-name',
      });

      expect(mockRepo.update).toHaveBeenCalledWith(ROOM_ID, {
        name: 'new-name',
      });
      expect(result).toEqual(updated);
    });

    it('should throw ForbiddenException when called by a non-owner', async () => {
      mockRepo.findById.mockResolvedValue(waitingRoom);

      await expect(
        service.update(PLAYER_ID, ROOM_ID, { name: 'new-name' }),
      ).rejects.toThrow(
        new ForbiddenException('Only the room owner can update it'),
      );
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the room does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        service.update(OWNER_ID, ROOM_ID, { name: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
