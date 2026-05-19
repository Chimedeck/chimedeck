// [context] Trello clients expect numeric `pos` while ChimeDeck uses rank/fractional index.
export function rankToPos(rank: number): number {
  return (rank + 1) * 65535;
}
