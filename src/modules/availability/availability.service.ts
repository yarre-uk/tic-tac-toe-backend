import * as path from 'path';
import { Worker } from 'worker_threads';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BloomFilter } from 'bloom-filters';
import { isDefined } from 'class-validator';

import { ApiConfigService, AppEvents, EventPayloads } from '@/libs';
import { UserIdentifiers, UserRepository } from '@/repositories';
import { WorkerInput, WorkerResult } from '@/workers/bloom-filter.worker';

@Injectable()
export class AvailabilityService implements OnModuleInit {
  private readonly logger = new Logger('AvailabilityService');

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

    this.logger.log('New Bloom filter has been issued');
  }

  private runWorker(identifiers: UserIdentifiers[]): Promise<WorkerResult> {
    // eslint-disable-next-line sonarjs/null-dereference
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

  private addNickname(nickname: string) {
    this.nicknameFilter.add(nickname);
  }

  private addEmail(email: string) {
    this.emailFilter.add(email);
  }

  @OnEvent(AppEvents.USER_CREATED)
  onUserCreated(payload: EventPayloads[typeof AppEvents.USER_CREATED]) {
    this.addUserIdentifiers(payload);
  }

  @OnEvent(AppEvents.USER_UPDATED)
  onUserUpdated(payload: EventPayloads[typeof AppEvents.USER_UPDATED]) {
    this.addUserIdentifiers(payload);
  }

  private addUserIdentifiers(payload: {
    nickname: string;
    email?: string | null;
  }) {
    this.addNickname(payload.nickname);

    if (payload.email) {
      this.addEmail(payload.email);
    }
  }

  createNickname(basis: string): string {
    const lowerCased = basis?.toLocaleLowerCase();

    if (!isDefined(lowerCased)) {
      throw new Error('No nickname basis were given to lowercase!');
    }

    if (!this.hasNickname(lowerCased)) {
      return lowerCased;
    }

    let counter = 1;

    while (this.hasNickname(`${lowerCased}${counter}`)) {
      counter++;
    }

    return `${lowerCased}${counter}`;
  }
}
