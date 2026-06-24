import type { GameResult, MoveResult } from './types';

import type { GameType } from '@/generated/prisma/enums';

export const GAME_ENGINES = 'GAME_ENGINES';

export interface GameEngine<TState extends object, TAction extends object> {
  readonly type: GameType;
  readonly dataTTL: number;

  /** Build the initial state for a new game. */
  init(playerIds: string[]): TState;

  /** Return false if the move is illegal — caller should reject before applying. */
  isValidMove(state: TState, userId: string, action: TAction): boolean;

  /** Apply the move and return the new state. result is null while game is ongoing. */
  applyMove(state: TState, userId: string, action: TAction): MoveResult<TState>;
}

export type AnyGameEngine = GameEngine<object, object>;

export { GameResult, MoveResult };
