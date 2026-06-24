import { Module } from '@nestjs/common';

import { TicTacToeEngine } from '../ttt/ttt.engine';
import { TicTacToeModule } from '../ttt/ttt.module';

import { AnyGameEngine, GAME_ENGINES } from './game-engine.interface';
import { GameEngineRegistry } from './game-engine.registry';
import { GameService } from './game.service';

@Module({
  imports: [TicTacToeModule],
  providers: [
    GameService,
    GameEngineRegistry,
    // When adding a second game (e.g. Chess):
    //   1. Create ChessModule the same way as TicTacToeModule
    //   2. Import ChessModule here
    //   3. Add ChessEngine to the inject array and the factory return
    {
      provide: GAME_ENGINES,
      useFactory: (ttt: TicTacToeEngine): AnyGameEngine[] => [ttt],
      inject: [TicTacToeEngine],
    },
  ],
  exports: [GameService],
})
export class GameModule {}
