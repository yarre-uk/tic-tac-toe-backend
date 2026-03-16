import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiConfigService } from './config.service';
import { EnvSchema } from './config.schema';

interface ApiConfigModuleOptions {
  global: boolean;
  envFilePath: string;
}

@Module({})
export class ApiConfigModule {
  static register({
    global,
    envFilePath,
  }: ApiConfigModuleOptions): DynamicModule {
    return {
      global,
      module: ApiConfigModule,
      imports: [
        ConfigModule.forRoot({
          envFilePath,
          isGlobal: true,
          validate: (envs) => EnvSchema.parse(envs),
        }),
      ],
      exports: [ApiConfigService],
      providers: [ApiConfigService],
    };
  }
}
