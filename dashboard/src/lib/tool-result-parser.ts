// ---------------------------------------------------------------------------
// Tool result parsing utilities for chat display.
//
// Provides helpers to classify tool calls (bash vs file-op), parse structured
// bash output, and inspect file content characteristics.
// ---------------------------------------------------------------------------

const BASH_TOOL_NAMES = new Set(["bash", "execute", "terminal"]);

const FILE_OP_MAP: Record<string, "write" | "edit" | "read"> = {
  write: "write",
  edit: "edit",
  read: "read",
  write_file: "write",
  read_file: "read",
};

export interface BashParsedResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Returns true when `toolName` refers to a bash/terminal tool.
 * Match is case-insensitive.
 */
export function isBashTool(toolName: string | undefined): boolean {
  if (!toolName) {
    return false;
  }
  return BASH_TOOL_NAMES.has(toolName.toLowerCase());
}

/**
 * Returns the file operation kind ("write" | "edit" | "read") if `toolName`
 * refers to a file operation tool, or null otherwise.
 * Match is case-insensitive.
 */
export function isFileOpTool(toolName: string | undefined): "write" | "edit" | "read" | null {
  if (!toolName) {
    return null;
  }
  return FILE_OP_MAP[toolName.toLowerCase()] ?? null;
}

/**
 * Attempts to parse structured bash output into command, stdout, stderr, and
 * exit code. Returns null if the content doesn't match the expected format.
 *
 * Expected format:
 *   $ <command>
 *   <stdout>
 *   stderr:
 *   <stderr>
 *   exit code: <N>
 *
 * Alternative exit code: `$?=<N>`
 */
export function parseBashResult(content: string): BashParsedResult | null {
  if (!content) {
    return null;
  }

  // Find exit code — required for a valid parse
  const exitMatch = content.match(/exit code:\s*(\d+)\s*$/m) ?? content.match(/\$\?=(\d+)\s*$/m);
  if (!exitMatch) {
    return null;
  }

  const exitCode = Number(exitMatch[1]);

  // Find command (line starting with "$ ")
  const cmdMatch = content.match(/^\$\s+(.+)$/m);
  const command = cmdMatch ? cmdMatch[1] : "";

  // Determine the position boundaries for stdout/stderr extraction
  const cmdEnd = cmdMatch ? (cmdMatch.index ?? 0) + cmdMatch[0].length : 0;
  const exitStart = exitMatch.index ?? content.length;

  // Split on stderr marker
  const bodyBetween = content.slice(cmdEnd, exitStart);
  const stderrIdx = bodyBetween.indexOf("\nstderr:");

  let stdout: string;
  let stderr: string;

  if (stderrIdx !== -1) {
    stdout = bodyBetween.slice(0, stderrIdx).replace(/^\n/, "").replace(/\n$/, "");
    // Skip the "\nstderr:" marker (8 chars) plus trailing newline
    stderr = bodyBetween
      .slice(stderrIdx + "\nstderr:".length)
      .replace(/^\n/, "")
      .replace(/\n$/, "");
  } else {
    stdout = bodyBetween.replace(/^\n/, "").replace(/\n$/, "");
    stderr = "";
  }

  return { command, stdout, stderr, exitCode };
}

/**
 * Extracts the file extension from a path. Returns empty string for no
 * extension, dotfiles, or undefined paths.
 */
export function getFileExtension(filePath: string | undefined): string {
  if (!filePath) {
    return "";
  }
  const base = filePath.split("/").pop() ?? filePath;
  const dotIdx = base.lastIndexOf(".");
  // No dot, or leading dot only (dotfile like .gitignore)
  if (dotIdx <= 0) {
    return "";
  }
  return base.slice(dotIdx + 1);
}

/**
 * Counts the number of lines in a string.
 * Returns 0 for empty string, 1 for single line (no newlines).
 */
export function countLines(content: string): number {
  if (content.length === 0) {
    return 0;
  }
  return content.split("\n").length;
}

/**
 * Detects binary content by checking for null bytes.
 */
export function isBinaryContent(content: string): boolean {
  return content.includes("\0");
}
