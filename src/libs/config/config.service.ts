import { isDefined } from '@/utils';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentValidation } from './config.schema';

@Injectable()
export class ApiConfigService {
  constructor(private readonly configService: ConfigService) {}
  get<K extends keyof EnvironmentValidation>(key: K) {
    const value = this.configService.get<EnvironmentValidation[K]>(
      key as string,
    ) as EnvironmentValidation[K];

    if (!isDefined(value)) {
      throw new InternalServerErrorException(`Env ${String(key)}: not found`);
    }

    return value;
  }
}
