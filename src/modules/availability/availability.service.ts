import * as path from 'path';
import { Worker } from 'worker_threads';
import { ApiConfigService } from '@/libs';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BloomFilter } from 'bloom-filters';
import { WorkerInput, WorkerResult } from '@/workers/bloom-filter.worker';
import { UserIdentifiers, UserRepository } from '@/repositories';

@Injectable()
export class AvailabilityService implements OnModuleInit {
  private nicknameFilter!: BloomFilter;
  private emailFilter!: BloomFilter;
  private falsePositiveRate: number;

  constructor(
    private readonly userRepository: UserRepository,
    configService: ApiConfigService,
  ) {
    this.falsePositiveRate = configService.get('FALSE_POSITIVE_RATE');
  }

  async onModuleInit() {
    await this.rebuild();
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async rebuild() {
    const identifiers = await this.userRepository.findAllIdentifiers();
    const { nicknameFilter, emailFilter } = await this.runWorker(identifiers);

    this.nicknameFilter = BloomFilter.fromJSON(nicknameFilter) as BloomFilter;
    this.emailFilter = BloomFilter.fromJSON(emailFilter) as BloomFilter;
  }

  private runWorker(identifiers: UserIdentifiers[]): Promise<WorkerResult> {
    const ext = __filename.endsWith('.ts') ? '.ts' : '.js';
    const workerPath = path.resolve(
      __dirname,
      '../../workers',
      `bloom-filter.worker${ext}`,
    );

    const workerData = {
      identifiers,
      falsePositiveRate: this.falsePositiveRate,
    } satisfies WorkerInput;

    return new Promise((resolve, reject) => {
      const worker = new Worker(workerPath, {
        workerData,
      });

      worker.once('message', resolve);
      worker.once('error', reject);
    });
  }

  hasNickname(nickname: string) {
    return this.nicknameFilter.has(nickname);
  }

  hasEmail(email: string) {
    return this.emailFilter.has(email);
  }

  addNickname(nickname: string) {
    this.nicknameFilter.add(nickname);
  }

  addEmail(email: string) {
    this.emailFilter.add(email);
  }
}
