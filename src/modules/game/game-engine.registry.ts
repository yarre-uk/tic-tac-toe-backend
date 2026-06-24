import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { AnyGameEngine, GAME_ENGINES } from './game-engine.interface';

import { GameType } from '@/generated/prisma/enums';
import { isDefined } from '@/utils';

@Injectable()
export class GameEngineRegistry {
  private readonly map = new Map<GameType, AnyGameEngine>();

  constructor(@Inject(GAME_ENGINES) engines: AnyGameEngine[]) {
    engines.forEach((e) => this.map.set(e.type, e));
  }

  get(type: GameType): AnyGameEngine {
    const engine = this.map.get(type);

    if (!isDefined(engine)) {
      throw new NotFoundException(
        `No engine registered for game type: ${type}`,
      );
    }

    return engine;
  }
}
