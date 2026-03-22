import { describe, it, expect } from "vitest";
import {
  isBashTool,
  isFileOpTool,
  parseBashResult,
  getFileExtension,
  countLines,
  isBinaryContent,
} from "./tool-result-parser.js";

describe("isBashTool", () => {
  it("matches 'bash' (case-insensitive)", () => {
    expect(isBashTool("bash")).toBe(true);
    expect(isBashTool("Bash")).toBe(true);
    expect(isBashTool("BASH")).toBe(true);
  });

  it("matches 'execute' (case-insensitive)", () => {
    expect(isBashTool("execute")).toBe(true);
    expect(isBashTool("Execute")).toBe(true);
  });

  it("matches 'terminal' (case-insensitive)", () => {
    expect(isBashTool("terminal")).toBe(true);
    expect(isBashTool("TERMINAL")).toBe(true);
  });

  it("rejects non-bash tool names", () => {
    expect(isBashTool("write")).toBe(false);
    expect(isBashTool("read")).toBe(false);
    expect(isBashTool("edit")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isBashTool(undefined)).toBe(false);
  });
});

describe("isFileOpTool", () => {
  it("returns 'write' for write tools", () => {
    expect(isFileOpTool("write")).toBe("write");
    expect(isFileOpTool("write_file")).toBe("write");
    expect(isFileOpTool("Write")).toBe("write");
    expect(isFileOpTool("Write_File")).toBe("write");
  });

  it("returns 'edit' for edit tools", () => {
    expect(isFileOpTool("edit")).toBe("edit");
    expect(isFileOpTool("Edit")).toBe("edit");
  });

  it("returns 'read' for read tools", () => {
    expect(isFileOpTool("read")).toBe("read");
    expect(isFileOpTool("read_file")).toBe("read");
    expect(isFileOpTool("Read")).toBe("read");
    expect(isFileOpTool("Read_File")).toBe("read");
  });

  it("returns null for non-file-op tools", () => {
    expect(isFileOpTool("bash")).toBeNull();
    expect(isFileOpTool("terminal")).toBeNull();
    expect(isFileOpTool("search")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(isFileOpTool(undefined)).toBeNull();
  });
});

describe("parseBashResult", () => {
  it("extracts command, stdout, stderr, and exitCode", () => {
    const content = `$ ls -la
total 0
drwxr-xr-x  2 user user 40 Jan 1 00:00 .
stderr:
permission denied
exit code: 1`;
    const result = parseBashResult(content);
    expect(result).not.toBeNull();
    expect(result!.command).toBe("ls -la");
    expect(result!.stdout).toContain("total 0");
    expect(result!.stderr).toContain("permission denied");
    expect(result!.exitCode).toBe(1);
  });

  it("handles successful command with no stderr", () => {
    const content = `$ echo hello
hello
exit code: 0`;
    const result = parseBashResult(content);
    expect(result).not.toBeNull();
    expect(result!.command).toBe("echo hello");
    expect(result!.stdout).toBe("hello");
    expect(result!.stderr).toBe("");
    expect(result!.exitCode).toBe(0);
  });

  it("handles $?=N exit code format", () => {
    const content = `$ cat /nonexistent
cat: /nonexistent: No such file
$?=2`;
    const result = parseBashResult(content);
    expect(result).not.toBeNull();
    expect(result!.exitCode).toBe(2);
    expect(result!.command).toBe("cat /nonexistent");
  });

  it("returns null for unrecognizable content", () => {
    expect(parseBashResult("just some random text")).toBeNull();
    expect(parseBashResult("")).toBeNull();
  });

  it("returns null when no exit code is found", () => {
    const content = `$ ls
file1 file2`;
    expect(parseBashResult(content)).toBeNull();
  });

  it("handles multiline stdout correctly", () => {
    const content = `$ find . -name "*.ts"
./src/index.ts
./src/lib/utils.ts
./src/app/page.ts
exit code: 0`;
    const result = parseBashResult(content);
    expect(result).not.toBeNull();
    expect(result!.stdout).toContain("./src/index.ts");
    expect(result!.stdout).toContain("./src/app/page.ts");
    expect(result!.exitCode).toBe(0);
  });

  it("handles content with only exit code and command", () => {
    const content = `$ true
exit code: 0`;
    const result = parseBashResult(content);
    expect(result).not.toBeNull();
    expect(result!.command).toBe("true");
    expect(result!.stdout).toBe("");
    expect(result!.exitCode).toBe(0);
  });
});

describe("getFileExtension", () => {
  it("extracts extension from file path", () => {
    expect(getFileExtension("foo/bar.ts")).toBe("ts");
    expect(getFileExtension("main.py")).toBe("py");
    expect(getFileExtension("/usr/local/bin/script.sh")).toBe("sh");
  });

  it("returns empty string for no extension", () => {
    expect(getFileExtension("Makefile")).toBe("");
    expect(getFileExtension("/usr/bin/node")).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(getFileExtension(undefined)).toBe("");
  });

  it("handles dotfiles", () => {
    expect(getFileExtension(".gitignore")).toBe("");
  });

  it("handles multiple dots", () => {
    expect(getFileExtension("archive.tar.gz")).toBe("gz");
  });
});

describe("countLines", () => {
  it("counts newlines correctly", () => {
    expect(countLines("a\nb\nc")).toBe(3);
    expect(countLines("line1\nline2\nline3\nline4")).toBe(4);
  });

  it("returns 1 for single line", () => {
    expect(countLines("hello")).toBe(1);
  });

  it("returns 0 for empty string", () => {
    expect(countLines("")).toBe(0);
  });
});

describe("isBinaryContent", () => {
  it("detects null bytes", () => {
    expect(isBinaryContent("hello\x00world")).toBe(true);
    expect(isBinaryContent("\x00")).toBe(true);
  });

  it("returns false for regular text", () => {
    expect(isBinaryContent("hello world")).toBe(false);
    expect(isBinaryContent("foo\nbar\n")).toBe(false);
    expect(isBinaryContent("")).toBe(false);
  });
});
