import { Injectable } from '@nestjs/common';
import { isDefined } from 'class-validator';

import type { GameEngine, MoveResult } from '../game/game-engine.interface';

import { GameType } from '@/generated/prisma/enums';

export type TicTacToeState = {
  board: (string | null)[]; // 9 cells — null = empty, string = userId who played there
  currentPlayerId: string;
  playerIds: [string, string];
};

export type TicTacToeAction = {
  cellId: number; // 0–8
};

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

@Injectable()
export class TicTacToeEngine implements GameEngine<
  TicTacToeState,
  TicTacToeAction
> {
  readonly type = GameType.TTT;
  readonly dataTTL = 60 * 60; // 1 hour

  init(playerIds: string[]): TicTacToeState {
    return {
      // eslint-disable-next-line sonarjs/argument-type
      board: Array<null>(9).fill(null),
      currentPlayerId: playerIds[0],
      playerIds: [playerIds[0], playerIds[1]],
    };
  }

  isValidMove(
    state: TicTacToeState,
    userId: string,
    action: TicTacToeAction,
  ): boolean {
    return (
      state.currentPlayerId === userId &&
      action.cellId >= 0 &&
      action.cellId < 9 &&
      state.board[action.cellId] === null
    );
  }

  applyMove(
    state: TicTacToeState,
    userId: string,
    action: TicTacToeAction,
  ): MoveResult<TicTacToeState> {
    const board = [...state.board];
    board[action.cellId] = userId;

    const winnerId = this.findWinner(board);
    const isDraw = !isDefined(winnerId) && board.every(Boolean);
    const nextPlayer = state.playerIds.find((id) => id !== userId)!;

    const newState = { ...state, board, currentPlayerId: nextPlayer };

    if (isDefined(winnerId)) {
      return {
        state: newState,
        result: { winner: winnerId, isDraw: false },
      };
    }

    return {
      state: newState,
      result: isDraw ? { winner: null, isDraw: true } : null,
    };
  }

  private findWinner(board: (string | null)[]): string | null {
    for (const [a, b, c] of WIN_LINES) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }

    return null;
  }
}
