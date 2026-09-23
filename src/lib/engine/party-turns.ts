/**
 * Pure turn-order bookkeeping for a Party's shared scene. The captain
 * always goes first among humans (the narrator itself always responds
 * before any human gets a turn — that part is enforced by the caller via
 * Party.awaitingNarrator, not here).
 */

export function buildTurnOrder(memberIdsInJoinOrder: string[], captainId: string): string[] {
  const rest = memberIdsInJoinOrder.filter((id) => id !== captainId);
  return memberIdsInJoinOrder.includes(captainId) ? [captainId, ...rest] : rest;
}

export function nextTurnIndex(turnOrder: string[], currentIndex: number): number {
  if (turnOrder.length === 0) return 0;
  return (currentIndex + 1) % turnOrder.length;
}
