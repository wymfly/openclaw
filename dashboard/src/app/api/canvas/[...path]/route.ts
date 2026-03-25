/**
 * /api/canvas/[...path] — Wildcard proxy for Gateway A2UI canvas assets.
 *
 * Proxies GET requests to the Gateway's /__openclaw__/a2ui/* endpoint.
 * HTML responses get a postMessage bridge script injected before </body>.
 * Non-HTML responses (JS, CSS, images) are passed through as-is.
 */
import { type NextRequest, NextResponse } from "next/server";
import { getGatewayHttpUrl, getGatewayToken } from "@/lib/gateway-http";

const BRIDGE_SCRIPT = `
<script>
(() => {
  const DECK_ORIGIN = window.location.ancestorOrigins?.[0] ?? "*";
  window.addEventListener("message", (e) => {
    if (DECK_ORIGIN !== "*" && e.origin !== DECK_ORIGIN) return;
    if (e.data?.type === "a2ui:push") {
      globalThis.openclawA2UI?.applyMessages(e.data.messages);
      window.parent.postMessage(
        { type: "a2ui:surfaces-changed", surfaces: globalThis.openclawA2UI?.getSurfaces?.() ?? [] },
        DECK_ORIGIN,
      );
    } else if (e.data?.type === "a2ui:reset") {
      globalThis.openclawA2UI?.reset();
    } else if (e.data?.type === "a2ui:action-status") {
      window.dispatchEvent(new CustomEvent("openclaw:a2ui-action-status", {
        detail: { id: e.data.id, ok: e.data.ok, error: e.data.error },
      }));
    } else if (e.data?.type === "a2ui:get-tree") {
      const host = document.querySelector("openclaw-a2ui-host");
      let tree = null;
      try {
        const surfaces = host?.shadowRoot?.querySelector("#surfaces");
        if (surfaces) {
          tree = Array.from(surfaces.querySelectorAll("a2ui-surface")).map((el) => ({
            surfaceId: el.getAttribute("surface-id") ?? "unknown",
            componentCount: el.shadowRoot?.querySelectorAll("[data-component-id]")?.length ?? 0,
          }));
        }
      } catch {}
      window.parent.postMessage({ type: "a2ui:tree-data", tree }, DECK_ORIGIN);
    } else if (e.data?.type === "a2ui:eval") {
      try {
        var result = eval(e.data.javaScript);
        window.parent.postMessage(
          { type: "a2ui:eval-result", evalId: e.data.evalId, result: result },
          DECK_ORIGIN,
        );
      } catch (err) {
        window.parent.postMessage(
          { type: "a2ui:eval-result", evalId: e.data.evalId, result: null, error: String(err) },
          DECK_ORIGIN,
        );
      }
    }
  });
  window.openclawCanvasA2UIAction = {
    postMessage: (payload) => {
      const parsed = JSON.parse(payload);
      window.parent.postMessage(
        { type: "a2ui:action", userAction: parsed.userAction ?? parsed },
        DECK_ORIGIN,
      );
    },
  };
  window.parent.postMessage({ type: "a2ui:ready" }, DECK_ORIGIN);
})();
</script>`;

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5 MB
const FETCH_TIMEOUT_MS = 10_000;

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(_request: NextRequest, ctx: RouteContext) {
  const base = getGatewayHttpUrl();
  if (!base) {
    return NextResponse.json({ error: "Gateway URL not configured" }, { status: 502 });
  }

  // SSRF protection: only allow http/https protocols
  if (!/^https?:\/\//.test(base)) {
    return NextResponse.json({ error: "Invalid gateway URL protocol" }, { status: 400 });
  }

  const token = getGatewayToken();
  const { path } = await ctx.params;
  const subPath = path?.join("/") ?? "";

  // Path traversal protection: reject ".." segments and normalize
  if (subPath.includes("..") || /[^\w.\-/]/.test(subPath)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  const targetUrl = `${base.replace(/\/$/, "")}/__openclaw__/a2ui/${subPath}`;

  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(targetUrl, {
      cache: "no-store",
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Gateway returned ${res.status}` },
        { status: res.status >= 500 ? 502 : res.status },
      );
    }

    const contentType = res.headers.get("content-type") ?? "";
    const contentLength = Number(res.headers.get("content-length") ?? "0");

    // Size guard
    if (contentLength > MAX_RESPONSE_SIZE) {
      return NextResponse.json({ error: "Response too large" }, { status: 502 });
    }

    // HTML responses: inject bridge script before </body>
    if (contentType.includes("text/html")) {
      let html = await res.text();
      if (html.length > MAX_RESPONSE_SIZE) {
        return NextResponse.json({ error: "Response too large" }, { status: 502 });
      }
      const idx = html.toLowerCase().lastIndexOf("</body>");
      if (idx >= 0) {
        html = html.slice(0, idx) + BRIDGE_SCRIPT + html.slice(idx);
      } else {
        html += BRIDGE_SCRIPT;
      }
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    // Non-HTML: pass-through (JS, CSS, images, etc.)
    const body = await res.arrayBuffer();
    if (body.byteLength > MAX_RESPONSE_SIZE) {
      return NextResponse.json({ error: "Response too large" }, { status: 502 });
    }
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": contentType.includes("javascript") ? "public, max-age=3600" : "no-store",
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return NextResponse.json({ error: "Gateway timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "Failed to fetch canvas host" }, { status: 502 });
  }
}
