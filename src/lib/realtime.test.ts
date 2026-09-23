import { describe, it, expect, vi } from "vitest";
import { RealtimeHub, hub, notifyCharacters } from "./realtime";

describe("RealtimeHub", () => {
  it("delivers a published event to every subscriber of that character only", () => {
    const h = new RealtimeHub();
    const a = vi.fn();
    const a2 = vi.fn();
    const b = vi.fn();
    h.subscribe("a", a);
    h.subscribe("a", a2);
    h.subscribe("b", b);
    expect(h.publish(["a"])).toBe(2);
    expect(a).toHaveBeenCalledTimes(1);
    expect(a2).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it("does not double-deliver when the same id is listed twice", () => {
    const h = new RealtimeHub();
    const a = vi.fn();
    h.subscribe("a", a);
    h.publish(["a", "a"]);
    expect(a).toHaveBeenCalledTimes(1);
  });

  it("stops delivering after unsubscribe and cleans up empty sets", () => {
    const h = new RealtimeHub();
    const a = vi.fn();
    const off = h.subscribe("a", a);
    expect(h.subscriberCount("a")).toBe(1);
    off();
    expect(h.subscriberCount()).toBe(0);
    h.publish(["a"]);
    expect(a).not.toHaveBeenCalled();
  });

  it("a throwing listener never breaks the publisher or the other listeners, and is dropped", () => {
    const h = new RealtimeHub();
    const bad = vi.fn(() => {
      throw new Error("stream closed");
    });
    const good = vi.fn();
    h.subscribe("a", bad);
    h.subscribe("a", good);
    expect(() => h.publish(["a"])).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
    expect(h.subscriberCount("a")).toBe(1);
  });

  it("carries the event payload", () => {
    const h = new RealtimeHub();
    const a = vi.fn();
    h.subscribe("a", a);
    h.publish(["a"], { type: "refresh", reason: "joint-fight" });
    expect(a).toHaveBeenCalledWith({ type: "refresh", reason: "joint-fight" });
  });

  it("the shared global hub backs notifyCharacters, and an empty list is a no-op", () => {
    const a = vi.fn();
    const off = hub.subscribe("zz", a);
    notifyCharacters(["zz"], "test");
    notifyCharacters([]);
    expect(a).toHaveBeenCalledTimes(1);
    off();
  });
});
