export type GameResult = {
  winner: string | null;
  isDraw: boolean;
};

export type MoveResult<TState> = {
  state: TState;
  result: GameResult | null;
};
