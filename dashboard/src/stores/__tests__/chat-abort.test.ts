import { describe, expect, it } from "vitest";
import { abortSession, getSessionAbort } from "../chat-abort";

describe("chat-abort", () => {
  describe("getSessionAbort", () => {
    it("returns the same instance for the same key", () => {
      const a = getSessionAbort("sess-1");
      const b = getSessionAbort("sess-1");
      expect(a).toBe(b);
    });

    it("returns different instances for different keys", () => {
      const a = getSessionAbort("sess-a");
      const b = getSessionAbort("sess-b");
      expect(a).not.toBe(b);
    });
  });

  describe("abortSession", () => {
    it("aborts the controller and removes it from the map", () => {
      const ctrl = getSessionAbort("sess-abort");
      expect(ctrl.signal.aborted).toBe(false);

      abortSession("sess-abort");

      expect(ctrl.signal.aborted).toBe(true);
      // A subsequent get should return a new, non-aborted controller
      const fresh = getSessionAbort("sess-abort");
      expect(fresh).not.toBe(ctrl);
      expect(fresh.signal.aborted).toBe(false);
    });

    it("is a no-op for unknown keys", () => {
      // Should not throw
      expect(() => abortSession("nonexistent")).not.toThrow();
    });
  });
});
