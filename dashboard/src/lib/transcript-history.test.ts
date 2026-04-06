import { describe, expect, it, vi } from "vitest";

const { gwCall } = vi.hoisted(() => ({
  gwCall: vi.fn(),
}));

vi.mock("@/lib/api-helpers", () => ({
  gwCall,
}));

import { fetchTranscriptHistory } from "./transcript-history";

describe("fetchTranscriptHistory", () => {
  it("reads messages through the chat.history seam", async () => {
    gwCall.mockReset();
    gwCall.mockResolvedValue({
      messages: [{ id: "m1", role: "user", content: "hi" }],
    });

    const messages = await fetchTranscriptHistory({ sessionKey: "agent:main:main", limit: 5 });

    expect(gwCall).toHaveBeenCalledWith("chat.history", {
      sessionKey: "agent:main:main",
      limit: 5,
    });
    expect(messages).toHaveLength(1);
  });

  it("returns an empty list when payload has no messages array", async () => {
    gwCall.mockReset();
    gwCall.mockResolvedValue({});

    const messages = await fetchTranscriptHistory({ sessionKey: "s1" });

    expect(messages).toEqual([]);
  });
});
