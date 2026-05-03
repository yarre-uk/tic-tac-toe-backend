/* eslint-disable @typescript-eslint/no-explicit-any */
import { DynamicModule, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

export const PRISMA_OPTIONS_KEY = 'PRISMA_MODULE_OPTIONS_KEY';

export interface PrismaModuleOptions {
  global?: boolean;
  dbUrl: string;
}

interface PrismaModuleAsyncOptions {
  global?: boolean;
  inject?: any[];
  imports?: any[];
  useFactory: (
    ...args: any[]
  ) => PrismaModuleOptions | Promise<PrismaModuleOptions>;
}

@Module({})
export class PrismaModule {
  static register({ dbUrl, global }: PrismaModuleOptions): DynamicModule {
    return {
      global,
      module: PrismaModule,
      exports: [PrismaService],
      providers: [
        PrismaService,
        {
          provide: PRISMA_OPTIONS_KEY,
          useValue: dbUrl,
        },
      ],
    };
  }

  static registerAsync({
    global,
    useFactory,
    inject,
    imports,
  }: PrismaModuleAsyncOptions): DynamicModule {
    return {
      global,
      module: PrismaModule,
      imports: imports ?? [],
      exports: [PrismaService],
      providers: [
        PrismaService,
        {
          provide: PRISMA_OPTIONS_KEY,
          inject: inject ?? [],
          useFactory,
        },
      ],
    };
  }
}
