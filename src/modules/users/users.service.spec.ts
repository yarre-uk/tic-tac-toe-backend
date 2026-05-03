import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { UsersService } from './users.service';

import { Prisma } from '@/generated/prisma/client';
import { Role } from '@/generated/prisma/enums';
import { AppEvents } from '@/libs';
import { TypedEventEmitter } from '@/libs';
import { UserRepository } from '@/repositories';

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_ID = 'user-id-123';
const GOOGLE_ID = 'google-id-abc';
const EMAIL = 'john@example.com';
const NICKNAME = 'john';

const mockUser = {
  id: USER_ID,
  nickname: NICKNAME,
  email: EMAIL,
  googleId: null,
  password: '$2b$10$hash',
  role: Role.User,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeNicknameConflictError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '0.0.0',
    meta: { target: ['nickname'] },
  });
}

// ─── Shared mocks ─────────────────────────────────────────────────────────────

let mockRepo: {
  findAll: jest.Mock;
  findById: jest.Mock;
  findByEmail: jest.Mock;
  findByNickname: jest.Mock;
  findByGoogleId: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

let mockEventEmitter: { emit: jest.Mock };

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    mockRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByNickname: jest.fn(),
      findByGoogleId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockEventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UserRepository, useValue: mockRepo },
        { provide: TypedEventEmitter, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all users from the repository', async () => {
      mockRepo.findAll.mockResolvedValue([mockUser]);

      await expect(service.findAll()).resolves.toEqual([mockUser]);
      expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return the user when found', async () => {
      mockRepo.findById.mockResolvedValue(mockUser);

      await expect(service.findOne(USER_ID)).resolves.toEqual(mockUser);
    });

    it('should throw NotFoundException when the user does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.findOne(USER_ID)).rejects.toThrow(
        new NotFoundException(`User ${USER_ID} not found`),
      );
    });
  });

  // ─── findByEmail ──────────────────────────────────────────────────────────

  describe('findByEmail', () => {
    it('should return the user when found', async () => {
      mockRepo.findByEmail.mockResolvedValue(mockUser);

      await expect(service.findByEmail(EMAIL)).resolves.toEqual(mockUser);
    });

    it('should throw NotFoundException when the email is not registered', async () => {
      mockRepo.findByEmail.mockResolvedValue(null);

      await expect(service.findByEmail(EMAIL)).rejects.toThrow(
        new NotFoundException(`User ${EMAIL} not found`),
      );
    });
  });

  // ─── findByNickname ───────────────────────────────────────────────────────

  describe('findByNickname', () => {
    it('should return the user when found', async () => {
      mockRepo.findByNickname.mockResolvedValue(mockUser);

      await expect(service.findByNickname(NICKNAME)).resolves.toEqual(mockUser);
    });

    it('should throw NotFoundException when the nickname is not registered', async () => {
      mockRepo.findByNickname.mockResolvedValue(null);

      await expect(service.findByNickname(NICKNAME)).rejects.toThrow(
        new NotFoundException(`User ${NICKNAME} not found`),
      );
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { nickname: NICKNAME, email: EMAIL, password: 'P@ss123!' };

    it('should create the user with Role.User and return it', async () => {
      mockRepo.create.mockResolvedValue(mockUser);

      const result = await service.create(dto);

      expect(mockRepo.create).toHaveBeenCalledWith({
        ...dto,
        role: Role.User,
      });
      expect(result).toEqual(mockUser);
    });

    it('should emit USER_CREATED after creation', async () => {
      mockRepo.create.mockResolvedValue(mockUser);

      await service.create(dto);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        AppEvents.USER_CREATED,
        {
          userId: mockUser.id,
          nickname: mockUser.nickname,
          email: mockUser.email,
          role: mockUser.role,
        },
      );
    });
  });

  // ─── findOrCreateGoogleUser ───────────────────────────────────────────────

  describe('findOrCreateGoogleUser', () => {
    const profile = { googleId: GOOGLE_ID, email: EMAIL, nickname: NICKNAME };

    it('should return existing user when found by googleId', async () => {
      mockRepo.findByGoogleId.mockResolvedValue(mockUser);

      const result = await service.findOrCreateGoogleUser(profile);

      expect(result).toEqual(mockUser);
      expect(mockRepo.findByEmail).not.toHaveBeenCalled();
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('should link googleId to an existing account found by email', async () => {
      const linked = { ...mockUser, googleId: GOOGLE_ID };
      mockRepo.findByGoogleId.mockResolvedValue(null);
      mockRepo.findByEmail.mockResolvedValue(mockUser);
      mockRepo.update.mockResolvedValue(linked);

      const result = await service.findOrCreateGoogleUser(profile);

      expect(mockRepo.update).toHaveBeenCalledWith(USER_ID, {
        googleId: GOOGLE_ID,
      });
      expect(result).toEqual(linked);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('should create a new user when no account exists', async () => {
      const created = { ...mockUser, googleId: GOOGLE_ID, password: null };
      mockRepo.findByGoogleId.mockResolvedValue(null);
      mockRepo.findByEmail.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(created);

      const result = await service.findOrCreateGoogleUser(profile);

      expect(mockRepo.create).toHaveBeenCalledWith({
        googleId: GOOGLE_ID,
        email: EMAIL,
        nickname: NICKNAME,
        password: null,
        role: Role.User,
      });
      expect(result).toEqual(created);
    });

    it('should emit USER_CREATED after creating a new Google user', async () => {
      const created = { ...mockUser, googleId: GOOGLE_ID, password: null };
      mockRepo.findByGoogleId.mockResolvedValue(null);
      mockRepo.findByEmail.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(created);

      await service.findOrCreateGoogleUser(profile);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        AppEvents.USER_CREATED,
        {
          userId: created.id,
          nickname: created.nickname,
          email: created.email,
          role: created.role,
        },
      );
    });

    it('should retry with an incremented nickname on P2002 conflict and succeed', async () => {
      const created = {
        ...mockUser,
        googleId: GOOGLE_ID,
        nickname: `${NICKNAME}1`,
        password: null,
      };
      mockRepo.findByGoogleId.mockResolvedValue(null);
      mockRepo.findByEmail.mockResolvedValue(null);
      mockRepo.create
        .mockRejectedValueOnce(makeNicknameConflictError())
        .mockResolvedValueOnce(created);

      const result = await service.findOrCreateGoogleUser(profile);

      expect(mockRepo.create).toHaveBeenCalledTimes(2);
      expect(mockRepo.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ nickname: `${NICKNAME}1` }),
      );
      expect(result).toEqual(created);
    });

    it('should rethrow non-nickname Prisma errors immediately', async () => {
      const emailConflict = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '0.0.0', meta: { target: ['email'] } },
      );
      mockRepo.findByGoogleId.mockResolvedValue(null);
      mockRepo.findByEmail.mockResolvedValue(null);
      mockRepo.create.mockRejectedValue(emailConflict);

      await expect(service.findOrCreateGoogleUser(profile)).rejects.toThrow(
        emailConflict,
      );
      expect(mockRepo.create).toHaveBeenCalledTimes(1);
    });

    it('should throw InternalServerErrorException after exhausting all attempts', async () => {
      mockRepo.findByGoogleId.mockResolvedValue(null);
      mockRepo.findByEmail.mockResolvedValue(null);
      mockRepo.create.mockRejectedValue(makeNicknameConflictError());

      await expect(service.findOrCreateGoogleUser(profile)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(mockRepo.create).toHaveBeenCalledTimes(10);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    const dto = { nickname: 'newname' };

    it('should update the user and return the result', async () => {
      const updated = { ...mockUser, nickname: 'newname' };
      mockRepo.findById.mockResolvedValue(mockUser);
      mockRepo.update.mockResolvedValue(updated);

      const result = await service.update(USER_ID, dto);

      expect(mockRepo.update).toHaveBeenCalledWith(USER_ID, dto);
      expect(result).toEqual(updated);
    });

    it('should emit USER_UPDATED after updating', async () => {
      const updated = { ...mockUser, nickname: 'newname' };
      mockRepo.findById.mockResolvedValue(mockUser);
      mockRepo.update.mockResolvedValue(updated);

      await service.update(USER_ID, dto);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        AppEvents.USER_UPDATED,
        {
          userId: updated.id,
          nickname: updated.nickname,
          email: updated.email,
          role: updated.role,
        },
      );
    });

    it('should throw NotFoundException when the user does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.update(USER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });

  // ─── delete ───────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete the user and return the deleted record', async () => {
      mockRepo.findById.mockResolvedValue(mockUser);
      mockRepo.delete.mockResolvedValue(mockUser);

      const result = await service.delete(USER_ID);

      expect(mockRepo.delete).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when the user does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.delete(USER_ID)).rejects.toThrow(NotFoundException);
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });
  });
});
