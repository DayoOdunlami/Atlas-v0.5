export type TurnIndexRow = { turn_index: number };

export function nextTurnIndexFromRows(turns: TurnIndexRow[]): number {
  if (turns.length === 0) return 0;
  return Math.max(...turns.map((t) => t.turn_index)) + 1;
}
