import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiConfigService } from './config.service';
import { EnvironmentValidationSchema } from './config.schema';

@Module({})
export class ApiConfigModule {
  static register(): DynamicModule {
    return {
      global: true,
      module: ApiConfigModule,
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env',
          isGlobal: true,
          validate: (envs) => EnvironmentValidationSchema.parse(envs),
        }),
      ],
      exports: [ApiConfigService],
      providers: [ApiConfigService],
    };
  }
}
