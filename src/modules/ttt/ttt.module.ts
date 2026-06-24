import { Module } from '@nestjs/common';

import { GAME_ENGINES } from '../game/game-engine.interface';

import { TicTacToeEngine } from './ttt.engine';

@Module({
  providers: [
    TicTacToeEngine,
    { provide: GAME_ENGINES, useExisting: TicTacToeEngine },
  ],
  exports: [GAME_ENGINES],
})
export class TicTacToeModule {}
