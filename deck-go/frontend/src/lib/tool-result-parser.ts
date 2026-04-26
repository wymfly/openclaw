const BASH_TOOL_NAMES = new Set(["bash", "execute", "terminal"]);

const FILE_OP_MAP: Record<string, "write" | "edit" | "read"> = {
  edit: "edit",
  read: "read",
  read_file: "read",
  write: "write",
  write_file: "write",
};

export type BashParsedResult = {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
};

export function isBashTool(toolName: string | undefined): boolean {
  return toolName ? BASH_TOOL_NAMES.has(toolName.toLowerCase()) : false;
}

export function isFileOpTool(toolName: string | undefined): "write" | "edit" | "read" | null {
  return toolName ? (FILE_OP_MAP[toolName.toLowerCase()] ?? null) : null;
}

export function parseBashResult(content: string): BashParsedResult | null {
  if (!content) {
    return null;
  }

  const exitMatch = content.match(/exit code:\s*(\d+)\s*$/m) ?? content.match(/\$\?=(\d+)\s*$/m);
  if (!exitMatch) {
    return null;
  }

  const commandMatch = content.match(/^\$\s+(.+)$/m);
  const command = commandMatch?.[1] ?? "";
  const commandEnd = commandMatch ? (commandMatch.index ?? 0) + commandMatch[0].length : 0;
  const exitStart = exitMatch.index ?? content.length;
  const body = content.slice(commandEnd, exitStart);
  const stderrIndex = body.indexOf("\nstderr:");

  if (stderrIndex >= 0) {
    return {
      command,
      exitCode: Number(exitMatch[1]),
      stdout: body.slice(0, stderrIndex).replace(/^\n/, "").replace(/\n$/, ""),
      stderr: body
        .slice(stderrIndex + "\nstderr:".length)
        .replace(/^\n/, "")
        .replace(/\n$/, ""),
    };
  }

  return {
    command,
    exitCode: Number(exitMatch[1]),
    stdout: body.replace(/^\n/, "").replace(/\n$/, ""),
    stderr: "",
  };
}

export function getFileExtension(filePath: string | undefined): string {
  if (!filePath) {
    return "";
  }
  const base = filePath.split("/").pop() ?? filePath;
  const index = base.lastIndexOf(".");
  return index > 0 ? base.slice(index + 1).toLowerCase() : "";
}

export function countLines(content: string): number {
  return content ? content.split("\n").length : 0;
}

export function isBinaryContent(content: string): boolean {
  return content.includes("\0");
}
