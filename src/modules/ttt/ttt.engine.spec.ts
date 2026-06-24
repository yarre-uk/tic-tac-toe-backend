import type { GameResult } from '../game';

import { TicTacToeEngine } from './ttt.engine';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAYER_X = 'player-x-id';
const PLAYER_O = 'player-o-id';

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('TicTacToeEngine', () => {
  let engine: TicTacToeEngine;

  beforeEach(() => {
    engine = new TicTacToeEngine();
  });

  // ─── init ─────────────────────────────────────────────────────────────────

  describe('init', () => {
    it('should return an empty board of 9 nulls', () => {
      const state = engine.init([PLAYER_X, PLAYER_O]);

      expect(state.board).toHaveLength(9);
      expect(state.board.every((c) => c === null)).toBe(true);
    });

    it('should set the first player as currentPlayerId', () => {
      const state = engine.init([PLAYER_X, PLAYER_O]);

      expect(state.currentPlayerId).toBe(PLAYER_X);
    });

    it('should preserve the playerIds tuple', () => {
      const state = engine.init([PLAYER_X, PLAYER_O]);

      expect(state.playerIds).toEqual([PLAYER_X, PLAYER_O]);
    });
  });

  // ─── isValidMove ──────────────────────────────────────────────────────────

  describe('isValidMove', () => {
    it('should return true for a valid move on an empty cell', () => {
      const state = engine.init([PLAYER_X, PLAYER_O]);

      expect(engine.isValidMove(state, PLAYER_X, { cellId: 0 })).toBe(true);
    });

    it("should return false when it is not the player's turn", () => {
      const state = engine.init([PLAYER_X, PLAYER_O]);

      expect(engine.isValidMove(state, PLAYER_O, { cellId: 0 })).toBe(false);
    });

    it('should return false when the target cell is already occupied', () => {
      const state = engine.init([PLAYER_X, PLAYER_O]);
      const { state: after } = engine.applyMove(state, PLAYER_X, { cellId: 4 });

      expect(engine.isValidMove(after, PLAYER_O, { cellId: 4 })).toBe(false);
    });

    it('should return false for a cell index below 0', () => {
      const state = engine.init([PLAYER_X, PLAYER_O]);

      expect(engine.isValidMove(state, PLAYER_X, { cellId: -1 })).toBe(false);
    });

    it('should return false for a cell index above 8', () => {
      const state = engine.init([PLAYER_X, PLAYER_O]);

      expect(engine.isValidMove(state, PLAYER_X, { cellId: 9 })).toBe(false);
    });
  });

  // ─── applyMove ────────────────────────────────────────────────────────────

  describe('applyMove', () => {
    it('should place the userId in the correct cell', () => {
      const state = engine.init([PLAYER_X, PLAYER_O]);
      const { state: next } = engine.applyMove(state, PLAYER_X, { cellId: 4 });

      expect(next.board[4]).toBe(PLAYER_X);
    });

    it('should switch currentPlayerId after a move', () => {
      const state = engine.init([PLAYER_X, PLAYER_O]);
      const { state: next } = engine.applyMove(state, PLAYER_X, { cellId: 0 });

      expect(next.currentPlayerId).toBe(PLAYER_O);
    });

    it('should return null result when the game is still in progress', () => {
      const state = engine.init([PLAYER_X, PLAYER_O]);
      const { result } = engine.applyMove(state, PLAYER_X, { cellId: 0 });

      expect(result).toBeNull();
    });

    it('should not mutate the original state', () => {
      const state = engine.init([PLAYER_X, PLAYER_O]);
      const original = [...state.board];
      engine.applyMove(state, PLAYER_X, { cellId: 0 });

      expect(state.board).toEqual(original);
    });

    // ── win detection ────────────────────────────────────────────────────────

    it.each([
      ['top row', [0, 1, 2]],
      ['middle row', [3, 4, 5]],
      ['bottom row', [6, 7, 8]],
      ['left column', [0, 3, 6]],
      ['middle column', [1, 4, 7]],
      ['right column', [2, 5, 8]],
      ['main diagonal', [0, 4, 8]],
      ['anti diagonal', [2, 4, 6]],
    ])('should detect a win on the %s', (_label, [a, b, c]) => {
      // X plays a, b, c — O plays to neutral cells in between
      //    X     O     X     O     X  → X wins
      const neutral = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(
        (i) => i !== a && i !== b && i !== c,
      );

      let state = engine.init([PLAYER_X, PLAYER_O]);

      // Move sequence: X→a, O→neutral[0], X→b, O→neutral[1], X→c (wins)
      state = engine.applyMove(state, PLAYER_X, { cellId: a }).state;
      state = engine.applyMove(state, PLAYER_O, { cellId: neutral[0] }).state;
      state = engine.applyMove(state, PLAYER_X, { cellId: b }).state;
      state = engine.applyMove(state, PLAYER_O, { cellId: neutral[1] }).state;
      const { result } = engine.applyMove(state, PLAYER_X, { cellId: c });

      expect(result).toEqual({ winner: PLAYER_X, isDraw: false });
    });

    it('should detect a draw when all cells are filled with no winner', () => {
      // Forced draw sequence: X O X | O X O | O X O
      //  0 1 2 | 3 4 5 | 6 7 8
      //  X O X | O X O | O X O  ← no three in a row
      let state = engine.init([PLAYER_X, PLAYER_O]);

      const moves: [string, number][] = [
        [PLAYER_X, 0],
        [PLAYER_O, 1],
        [PLAYER_X, 2],
        [PLAYER_O, 3],
        [PLAYER_X, 4],
        [PLAYER_O, 6],
        [PLAYER_X, 5],
        [PLAYER_O, 8],
        [PLAYER_X, 7],
      ];

      let result: GameResult | null = null;

      for (const [player, cellId] of moves) {
        ({ state, result } = engine.applyMove(state, player, { cellId }));
      }

      expect(result).toEqual({ winner: null, isDraw: true });
    });
  });
});
