// Shared crew scene, in rounds: the narrator opens, every member writes their action, then the narrator answers ALL of them at once.

export type RoundActions = Record<string, string>;

export function parseRound(json: string | null | undefined): RoundActions {
  try {
    const v = JSON.parse(json ?? "{}");
    if (v && typeof v === "object" && !Array.isArray(v)) return Object.fromEntries(Object.entries(v).filter(([, t]) => typeof t === "string" && t.trim())) as RoundActions;
  } catch {
    /* fall through */
  }
  return {};
}

/** Who still has to act: members in join order who have not written anything this round. */
export function missingMembers(memberIds: string[], actions: RoundActions): string[] {
  return memberIds.filter((id) => !actions[id]);
}

export const roundComplete = (memberIds: string[], actions: RoundActions) => memberIds.length > 0 && missingMembers(memberIds, actions).length === 0;

/** Actions in the order the members joined (captain first), ignoring anyone who left. */
export function orderedActions(memberIds: string[], actions: RoundActions): { characterId: string; text: string }[] {
  return memberIds.filter((id) => actions[id]).map((id) => ({ characterId: id, text: actions[id] }));
}
