/* eslint-disable @typescript-eslint/no-explicit-any */

import { DynamicModule, Module } from '@nestjs/common';
import Redis from 'ioredis';

interface RedisModuleOptions {
  global?: boolean;
  host: string;
  password: string;
  port: number;
}

interface RedisModuleAsyncOptions {
  global?: boolean;
  inject?: any[];
  imports?: any[];
  useFactory: (
    ...args: any[]
  ) => RedisModuleOptions | Promise<RedisModuleOptions>;
}

const REDIS_CLIENT_KEY = 'REDIS_CLIENT_KEY';

@Module({})
export class RedisModule {
  static register({ global, host, port }: RedisModuleOptions): DynamicModule {
    return {
      global,
      module: RedisModule,
      exports: [REDIS_CLIENT_KEY],
      providers: [
        {
          provide: REDIS_CLIENT_KEY,
          useValue: new Redis({
            host,
            port,
          }),
        },
      ],
    };
  }

  static registerAsync(params: RedisModuleAsyncOptions): DynamicModule {
    return {
      global: params.global,
      module: RedisModule,
      imports: params.imports ?? [],
      providers: [
        {
          provide: REDIS_CLIENT_KEY,
          inject: params.inject ?? [],
          useFactory: async (args: any[]) => {
            const { host, port, password } = await params.useFactory(args);

            return new Redis({
              host,
              password,
              port,
            });
          },
        },
      ],
    };
  }
}
