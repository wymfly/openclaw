/**
 * GET /api/media?path=... — Serve a file from the local filesystem.
 *
 * Used by the chat UI to display agent-generated images and files.
 * Security: only serves files under allowed directories (~/.openclaw/media/
 * and agent workspace directories).
 */
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, normalize } from "node:path";
import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";

/** Directories that are allowed to be served. */
function getAllowedPrefixes(): string[] {
  const home = homedir();
  return [
    resolve(home, ".openclaw/media"),
    resolve(home, ".openclaw/agents"),
    resolve(home, ".openclaw/sessions"),
  ];
}

/** Basic MIME detection from extension. */
function mimeFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    json: "application/json",
    csv: "text/csv",
    txt: "text/plain",
    md: "text/markdown",
    html: "text/html",
    js: "text/javascript",
    ts: "text/typescript",
    py: "text/x-python",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    mp4: "video/mp4",
  };
  return mimeMap[ext] ?? "application/octet-stream";
}

export const GET = withAuth(async (request: NextRequest) => {
  const filePath = request.nextUrl.searchParams.get("path");
  if (!filePath) {
    return Response.json({ error: "path is required" }, { status: 400 });
  }

  // Resolve and normalize to prevent path traversal
  const resolved = resolve(normalize(filePath));

  // Security check: only allow files under known safe directories
  const allowed = getAllowedPrefixes();
  const isAllowed = allowed.some((prefix) => resolved.startsWith(prefix));
  if (!isAllowed) {
    return Response.json({ error: "access denied" }, { status: 403 });
  }

  try {
    const fileStat = await stat(resolved);
    if (!fileStat.isFile()) {
      return Response.json({ error: "not a file" }, { status: 404 });
    }

    const buffer = await readFile(resolved);
    const mime = mimeFromPath(resolved);
    const fileName = resolved.split("/").pop() ?? "file";

    // For downloads, check the `dl` query param
    const isDownload = request.nextUrl.searchParams.get("dl") === "1";

    return new Response(buffer, {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(buffer.byteLength),
        ...(isDownload
          ? { "Content-Disposition": `attachment; filename="${fileName}"` }
          : { "Content-Disposition": "inline" }),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return Response.json({ error: "file not found" }, { status: 404 });
  }
});
