export const CANVAS_ASSET_BASE_URL = "/api/runtime/gateway-assets/";

export function canvasAssetUrl(subpath: string): string {
  return `${CANVAS_ASSET_BASE_URL}${subpath.replace(/^\/+/, "")}`;
}

export function resolveCanvasAssetUrl(url: string | null): string {
  if (!url) {
    return canvasAssetUrl("a2ui/index.html");
  }
  if (/^(https?:|data:|blob:)/.test(url)) {
    return url;
  }
  if (url.startsWith(CANVAS_ASSET_BASE_URL)) {
    return url;
  }
  if (url.startsWith("/api/canvas/")) {
    const subpath = url.slice("/api/canvas/".length);
    return canvasAssetUrl(
      subpath.startsWith("documents/") ? `canvas/${subpath}` : `a2ui/${subpath}`,
    );
  }
  if (url.startsWith("/__openclaw__/canvas/")) {
    return canvasAssetUrl(`canvas/${url.slice("/__openclaw__/canvas/".length)}`);
  }
  if (url.startsWith("/__openclaw__/a2ui/")) {
    return canvasAssetUrl(`a2ui/${url.slice("/__openclaw__/a2ui/".length)}`);
  }
  return canvasAssetUrl(`a2ui/${url.replace(/^\/+/, "")}`);
}
