import { describe, expect, it } from "vitest";
import { CANVAS_ASSET_BASE_URL, canvasAssetUrl } from "./canvas-asset-config";

describe("canvas asset URL", () => {
  it("uses the BFF reverse-proxy route", () => {
    expect(CANVAS_ASSET_BASE_URL).toBe("/api/runtime/gateway-assets/");
    expect(canvasAssetUrl("a2ui/index.html")).toBe("/api/runtime/gateway-assets/a2ui/index.html");
  });

  it("normalizes leading slashes without leaving the BFF origin", () => {
    expect(canvasAssetUrl("/canvas/documents/demo/index.html")).toBe(
      "/api/runtime/gateway-assets/canvas/documents/demo/index.html",
    );
  });
});
