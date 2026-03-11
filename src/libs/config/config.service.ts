import { isDefined } from '@/utils';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvSchemaInferred } from './config.schema';

@Injectable()
export class ApiConfigService {
  constructor(private readonly configService: ConfigService) {}
  get<K extends keyof EnvSchemaInferred>(key: K) {
    const value = this.configService.get<EnvSchemaInferred[K]>(
      key as string,
    ) as EnvSchemaInferred[K];

    if (!isDefined(value)) {
      throw new InternalServerErrorException(`Env ${String(key)}: not found`);
    }

    return value;
  }
}
