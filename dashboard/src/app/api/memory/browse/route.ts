import { readdir, readFile, stat } from "node:fs/promises";
/**
 * GET /api/memory/browse — Browse memory files for an agent.
 *
 * Query params:
 *   - agentId (required): the agent whose memory to browse
 *   - path (optional): sub-path within the memory directory
 *   - read (optional): if "1", read file content instead of listing
 *
 * Uses `config.get` via Gateway RPC to resolve the memory path dynamically.
 * Path traversal protection ensures the resolved path stays within the memory root.
 */
import { resolve, relative } from "node:path";
import { getRuntime } from "@server/runtime";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

type FileEntry = {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
};

/**
 * Resolve the memory base directory for an agent.
 * Tries Gateway RPC `config.get` first, falls back to ~/.openclaw/agents/{agentId}.
 */
async function resolveMemoryPath(agentId: string): Promise<string | null> {
  const runtime = getRuntime();
  if (!runtime) {
    return null;
  }

  try {
    // Ask Gateway for the agent's memory/files path.
    const res = await runtime.adapter.request("agents.files.list", { agentId });
    // If we got a basePath from the gateway, use it.
    if (res && typeof res === "object" && "basePath" in res) {
      return (res as { basePath: string }).basePath;
    }
  } catch {
    // Gateway RPC failed — fall back to conventional path.
  }

  // Conventional fallback: ~/.openclaw/agents/<agentId>
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "/tmp";
  return resolve(home, ".openclaw", "agents", agentId);
}

/**
 * Validate that a resolved path does not escape the allowed base directory.
 * Returns the safe absolute path or null if traversal is detected.
 */
function safePath(base: string, subPath: string): string | null {
  const resolved = resolve(base, subPath);
  const rel = relative(base, resolved);
  // Traversal check: relative path must not start with ".." or be absolute.
  if (rel.startsWith("..") || resolve(rel) === rel) {
    return null;
  }
  return resolved;
}

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const agentId = searchParams.get("agentId");
  const subPath = searchParams.get("path") ?? "";
  const readMode = searchParams.get("read") === "1";

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const basePath = await resolveMemoryPath(agentId);
  if (!basePath) {
    return NextResponse.json({ error: "Could not resolve memory path" }, { status: 503 });
  }

  const targetPath = subPath ? safePath(basePath, subPath) : basePath;
  if (!targetPath) {
    return NextResponse.json({ error: "Invalid path — traversal detected" }, { status: 403 });
  }

  try {
    const info = await stat(targetPath);

    // Read file content.
    if (readMode || info.isFile()) {
      if (!info.isFile()) {
        return NextResponse.json({ error: "Not a file" }, { status: 400 });
      }
      const content = await readFile(targetPath, "utf-8");
      return NextResponse.json({ content, path: subPath });
    }

    // List directory.
    if (info.isDirectory()) {
      const entries = await readdir(targetPath, { withFileTypes: true });
      const files: FileEntry[] = [];
      for (const entry of entries) {
        // Skip hidden files and directories.
        if (entry.name.startsWith(".")) {
          continue;
        }
        const entryPath = subPath ? `${subPath}/${entry.name}` : entry.name;
        const entryType = entry.isDirectory() ? "directory" : "file";
        let size: number | undefined;
        if (entry.isFile()) {
          try {
            const s = await stat(resolve(targetPath, entry.name));
            size = s.size;
          } catch {
            // Skip stat errors.
          }
        }
        files.push({ name: entry.name, path: entryPath, type: entryType, size });
      }
      // Sort: directories first, then files, alphabetical within each group.
      files.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "directory" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      return NextResponse.json({ files });
    }

    return NextResponse.json({ error: "Unknown file type" }, { status: 400 });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return NextResponse.json({ files: [] });
    }
    return NextResponse.json({ error: "Failed to browse memory files" }, { status: 500 });
  }
});
