import { describe, expect, it } from "vitest";
import { DataFabricError } from "../errors/error-types";
import { controlledReadRetry } from "../errors/retry-policy";
import { createDataFabricQueryClient } from "./query-client";

describe("Data Fabric query client", () => {
  it("uses conservative query and mutation defaults", () => {
    const client = createDataFabricQueryClient();
    const defaults = client.getDefaultOptions();

    expect(defaults.queries?.refetchOnMount).toBe(false);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
    expect(defaults.queries?.refetchOnReconnect).toBe("always");
    expect(defaults.mutations?.retry).toBe(false);
    expect(defaults.mutations?.networkMode).toBe("online");
  });

  it("retries only controlled read failures", () => {
    expect(
      controlledReadRetry(
        0,
        new DataFabricError({ kind: "server", message: "server unavailable" }),
      ),
    ).toBe(true);
    expect(
      controlledReadRetry(
        2,
        new DataFabricError({ kind: "server", message: "server unavailable" }),
      ),
    ).toBe(false);
    expect(
      controlledReadRetry(
        0,
        new DataFabricError({ kind: "validation", message: "invalid request" }),
      ),
    ).toBe(false);
    expect(controlledReadRetry(0, new Error("raw error"))).toBe(false);
  });
});
