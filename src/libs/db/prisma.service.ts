import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { delay } from '@/utils';
import { PRISMA_OPTIONS_KEY } from './prisma.module';
import type { PrismaModuleOptions } from './prisma.module';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger('DB');

  constructor(@Inject(PRISMA_OPTIONS_KEY) options: PrismaModuleOptions) {
    const adapter = new PrismaPg({
      connectionString: options.dbUrl,
    });

    super({ adapter });
  }

  async onModuleInit() {
    let retries = 3;
    let connected = false;

    while (retries > 0) {
      try {
        await this.$connect();
        connected = true;
        break;
      } catch {
        this.logger.error(`Failed to connect to DB, retries left: ${retries}`);
        retries--;
        await delay(1000);
      }
    }

    if (!connected) {
      throw new Error('Could not connect to DB after all retries');
    }

    this.logger.log('Successfully connected to DB');
  }
  onModuleDestroy() {
    return this.$disconnect();
  }
}
