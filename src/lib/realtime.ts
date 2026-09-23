/**
 * In-process push hub for Server-Sent Events. The game runs as one persistent
 * Node process (Render web service), so an in-memory pub/sub is enough: game
 * code calls notifyCharacters() after any shared-state change and every open
 * stream for those characters tells its browser to refetch immediately. The
 * 10s poll stays as the safety net (dropped connections, cold starts) — push
 * only makes it instant. If the service is ever scaled past one instance this
 * needs a shared bus (e.g. Redis); until then keeping it in memory is the
 * "no extra infra" choice the rest of the project makes.
 */

export interface RealtimeEvent {
  type: "refresh";
  reason?: string;
}

type Listener = (event: RealtimeEvent) => void;

export class RealtimeHub {
  private listeners = new Map<string, Set<Listener>>();

  subscribe(characterId: string, listener: Listener): () => void {
    let set = this.listeners.get(characterId);
    if (!set) {
      set = new Set();
      this.listeners.set(characterId, set);
    }
    set.add(listener);
    return () => {
      const current = this.listeners.get(characterId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) this.listeners.delete(characterId);
    };
  }

  /** A throwing listener (a closed stream) must never break the game action that triggered the push. */
  publish(characterIds: string[], event: RealtimeEvent = { type: "refresh" }): number {
    let delivered = 0;
    for (const id of new Set(characterIds)) {
      for (const listener of [...(this.listeners.get(id) ?? [])]) {
        try {
          listener(event);
          delivered++;
        } catch {
          this.listeners.get(id)?.delete(listener);
        }
      }
    }
    return delivered;
  }

  subscriberCount(characterId?: string): number {
    if (characterId) return this.listeners.get(characterId)?.size ?? 0;
    let n = 0;
    for (const set of this.listeners.values()) n += set.size;
    return n;
  }
}

// Route handlers and game code can land in different module instances under the dev bundler; a global keeps one hub.
const g = globalThis as unknown as { __realtimeHub?: RealtimeHub };
export const hub: RealtimeHub = g.__realtimeHub ?? (g.__realtimeHub = new RealtimeHub());

export function notifyCharacters(characterIds: string[], reason?: string): void {
  if (characterIds.length === 0) return;
  hub.publish(characterIds, { type: "refresh", reason });
}
