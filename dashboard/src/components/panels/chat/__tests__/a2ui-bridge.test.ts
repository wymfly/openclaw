import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { A2UIBridge } from "../a2ui-bridge";

/**
 * Lightweight mock for window + MessageEvent in Node environment.
 * We intercept addEventListener/removeEventListener and provide a
 * manual dispatch mechanism.
 */
type Listener = (e: { origin: string; data: unknown }) => void;
const listeners: Listener[] = [];

function mockDispatch(origin: string, data: unknown) {
  // Snapshot via Array.from — listeners may mutate during iteration (detach)
  for (const fn of Array.from(listeners)) {
    fn({ origin, data });
  }
}

// Patch globalThis.window for the bridge code
beforeEach(() => {
  listeners.length = 0;
  (globalThis as Record<string, unknown>).window = {
    addEventListener: (_type: string, fn: Listener) => {
      listeners.push(fn);
    },
    removeEventListener: (_type: string, fn: Listener) => {
      const idx = listeners.indexOf(fn);
      if (idx >= 0) {
        listeners.splice(idx, 1);
      }
    },
    location: { origin: "http://localhost:3000" },
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe("A2UIBridge", () => {
  let bridge: A2UIBridge;
  const onReady = vi.fn();
  const onUserAction = vi.fn();
  const onSurfacesChanged = vi.fn();

  beforeEach(() => {
    bridge = new A2UIBridge({ onReady, onUserAction, onSurfacesChanged });
  });

  afterEach(() => {
    bridge.detach();
    vi.clearAllMocks();
  });

  it("calls onReady when receiving a2ui:ready message", () => {
    const iframe = { src: "http://localhost:18789/__openclaw__/a2ui/" } as HTMLIFrameElement;
    bridge.attach(iframe);
    mockDispatch("http://localhost:18789", { type: "a2ui:ready" });
    expect(onReady).toHaveBeenCalledOnce();
  });

  it("ignores messages from wrong origin", () => {
    const iframe = { src: "http://localhost:18789/__openclaw__/a2ui/" } as HTMLIFrameElement;
    bridge.attach(iframe);
    mockDispatch("http://evil.com", { type: "a2ui:ready" });
    expect(onReady).not.toHaveBeenCalled();
  });

  it("extracts userAction from a2ui:action message", () => {
    const iframe = { src: "http://localhost:18789/__openclaw__/a2ui/" } as HTMLIFrameElement;
    bridge.attach(iframe);
    const action = {
      id: "a1",
      name: "Buy",
      surfaceId: "main",
      sourceComponentId: "btn1",
      timestamp: "2026-03-21",
    };
    mockDispatch("http://localhost:18789", { type: "a2ui:action", userAction: action });
    expect(onUserAction).toHaveBeenCalledWith(action);
  });

  it("detach removes listener", () => {
    const iframe = { src: "http://localhost:18789/__openclaw__/a2ui/" } as HTMLIFrameElement;
    bridge.attach(iframe);
    bridge.detach();
    mockDispatch("http://localhost:18789", { type: "a2ui:ready" });
    expect(onReady).not.toHaveBeenCalled();
  });

  it("handles surfaces-changed messages", () => {
    const iframe = { src: "http://localhost:18789/__openclaw__/a2ui/" } as HTMLIFrameElement;
    bridge.attach(iframe);
    mockDispatch("http://localhost:18789", {
      type: "a2ui:surfaces-changed",
      surfaces: ["main", "sidebar"],
    });
    expect(onSurfacesChanged).toHaveBeenCalledWith(["main", "sidebar"]);
  });
});
