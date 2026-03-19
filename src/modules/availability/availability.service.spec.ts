import { Test, TestingModule } from '@nestjs/testing';
import { BloomFilter } from 'bloom-filters';
import { Worker } from 'worker_threads';
import { AvailabilityService } from './availability.service';
import { UserRepository } from '@/repositories';
import { ApiConfigService } from '@/libs';
import type { WorkerResult } from '@/workers/bloom-filter.worker';

// ─── Module-level mocks (hoisted by Jest before imports) ─────────────────────

jest.mock('worker_threads', () => ({ Worker: jest.fn() }));
jest.mock('bloom-filters');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IDENTIFIERS = [
  { nickname: 'alice', email: 'alice@example.com' },
  { nickname: 'bob', email: null },
];

const MOCK_WORKER_RESULT: WorkerResult = {
  nicknameFilter: {} as JSON,
  emailFilter: {} as JSON,
};

/**
 * Makes the Worker constructor emit a successful `message` event.
 * The `once` implementation is called twice by runWorker:
 *   worker.once('message', resolve)  ← we fire this
 *   worker.once('error',   reject)   ← we silently ignore
 */
function setupWorkerSuccess(result: WorkerResult = MOCK_WORKER_RESULT) {
  (Worker as unknown as jest.Mock).mockImplementation(() => ({
    once: jest
      .fn()
      .mockImplementation((event: string, cb: (arg: unknown) => void) => {
        if (event === 'message') {
          cb(result);
        }
      }),
  }));
}

/**
 * Makes the Worker constructor emit an `error` event instead of `message`.
 */
function setupWorkerError(err: Error) {
  (Worker as unknown as jest.Mock).mockImplementation(() => ({
    once: jest
      .fn()
      .mockImplementation((event: string, cb: (arg: unknown) => void) => {
        if (event === 'error') {
          cb(err);
        }
      }),
  }));
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let mockNicknameFilter: { has: jest.Mock; add: jest.Mock };
  let mockEmailFilter: { has: jest.Mock; add: jest.Mock };
  let mockUserRepository: { findAllIdentifiers: jest.Mock };
  let fromJSONSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockNicknameFilter = { has: jest.fn(), add: jest.fn() };
    mockEmailFilter = { has: jest.fn(), add: jest.fn() };

    // rebuild() deserializes two filters in order: nickname first, email second
    fromJSONSpy = jest
      .spyOn(BloomFilter, 'fromJSON')
      .mockReturnValueOnce(mockNicknameFilter)
      .mockReturnValueOnce(mockEmailFilter);

    setupWorkerSuccess();

    mockUserRepository = {
      findAllIdentifiers: jest.fn().mockResolvedValue(IDENTIFIERS),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: UserRepository, useValue: mockUserRepository },
        {
          provide: ApiConfigService,
          useValue: { get: jest.fn().mockReturnValue(0.01) },
        },
      ],
    }).compile();

    // module.init() triggers onModuleInit → rebuild(), hydrating the filters.
    // compile() alone does NOT run lifecycle hooks — this is intentional so
    // tests have full control over when initialization happens.
    await module.init();

    service = module.get<AvailabilityService>(AvailabilityService);
  });

  // ─── onModuleInit / rebuild ───────────────────────────────────────────────

  describe('rebuild', () => {
    it('should fetch all user identifiers from the repository', () => {
      // module.init() in beforeEach already triggered one rebuild
      expect(mockUserRepository.findAllIdentifiers).toHaveBeenCalledTimes(1);
    });

    it('should spawn a Worker with the identifiers and the configured false-positive rate', () => {
      expect(Worker).toHaveBeenCalledWith(
        expect.stringContaining('bloom-filter.worker'),
        expect.objectContaining({
          workerData: {
            identifiers: IDENTIFIERS,
            falsePositiveRate: 0.01,
          },
        }),
      );
    });

    it('should deserialize the nickname filter first and the email filter second', () => {
      expect(fromJSONSpy).toHaveBeenCalledTimes(2);
      expect(fromJSONSpy).toHaveBeenNthCalledWith(
        1,
        MOCK_WORKER_RESULT.nicknameFilter,
      );
      expect(fromJSONSpy).toHaveBeenNthCalledWith(
        2,
        MOCK_WORKER_RESULT.emailFilter,
      );
    });

    it('should replace both filters after a second rebuild', async () => {
      const freshNicknameFilter = {
        has: jest.fn().mockReturnValue(true),
        add: jest.fn(),
      };
      const freshEmailFilter = {
        has: jest.fn().mockReturnValue(true),
        add: jest.fn(),
      };

      fromJSONSpy
        .mockReturnValueOnce(freshNicknameFilter)
        .mockReturnValueOnce(freshEmailFilter);
      setupWorkerSuccess();

      await service.rebuild();

      // The service must now query the new filter, not the old one
      expect(service.hasNickname('alice')).toBe(true);
      expect(mockNicknameFilter.has).not.toHaveBeenCalled();
      expect(freshNicknameFilter.has).toHaveBeenCalledWith('alice');
    });

    it('should reject when the Worker emits an error', async () => {
      setupWorkerError(new Error('Worker crashed'));

      await expect(service.rebuild()).rejects.toThrow('Worker crashed');
    });
  });

  // ─── hasNickname ──────────────────────────────────────────────────────────

  describe('hasNickname', () => {
    it('should return true when the nickname is present in the filter', () => {
      mockNicknameFilter.has.mockReturnValue(true);

      expect(service.hasNickname('alice')).toBe(true);
      expect(mockNicknameFilter.has).toHaveBeenCalledWith('alice');
    });

    it('should return false when the nickname is absent from the filter', () => {
      mockNicknameFilter.has.mockReturnValue(false);

      expect(service.hasNickname('ghost')).toBe(false);
    });
  });

  // ─── hasEmail ─────────────────────────────────────────────────────────────

  describe('hasEmail', () => {
    it('should return true when the email is present in the filter', () => {
      mockEmailFilter.has.mockReturnValue(true);

      expect(service.hasEmail('alice@example.com')).toBe(true);
      expect(mockEmailFilter.has).toHaveBeenCalledWith('alice@example.com');
    });

    it('should return false when the email is absent from the filter', () => {
      mockEmailFilter.has.mockReturnValue(false);

      expect(service.hasEmail('ghost@example.com')).toBe(false);
    });
  });

  // ─── addNickname ──────────────────────────────────────────────────────────

  describe('addNickname', () => {
    it('should add the nickname to the filter', () => {
      service.addNickname('newuser');

      expect(mockNicknameFilter.add).toHaveBeenCalledWith('newuser');
    });
  });

  // ─── addEmail ─────────────────────────────────────────────────────────────

  describe('addEmail', () => {
    it('should add the email to the filter', () => {
      service.addEmail('new@example.com');

      expect(mockEmailFilter.add).toHaveBeenCalledWith('new@example.com');
    });
  });
});
