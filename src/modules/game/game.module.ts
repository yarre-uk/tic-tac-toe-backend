import { Module } from '@nestjs/common';

import { TicTacToeEngine } from '../ttt/ttt.engine';
import { TicTacToeModule } from '../ttt/ttt.module';

import { AnyGameEngine, GAME_ENGINES } from './game-engine.interface';
import { GameEngineRegistry } from './game-engine.registry';
import { GameService } from './game.service';

import { GameRepository } from '@/repositories';

@Module({
  imports: [TicTacToeModule],
  providers: [
    GameService,
    GameEngineRegistry,
    GameRepository,
    {
      provide: GAME_ENGINES,
      useFactory: (ttt: TicTacToeEngine): AnyGameEngine[] => [ttt],
      inject: [TicTacToeEngine],
    },
  ],
  exports: [GameService],
})
export class GameModule {}
