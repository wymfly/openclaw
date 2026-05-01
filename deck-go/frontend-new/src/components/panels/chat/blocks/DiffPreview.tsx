import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { isBinaryContent } from "@/lib/tool-result-parser";
import "@/design-system/atoms/diff-view.css";

type DiffLineKind = "added" | "removed" | "context" | "hunk";

const KIND_TO_VARIANT: Record<DiffLineKind, string> = {
  added: "add",
  removed: "del",
  hunk: "hunk",
  context: "context",
};

type DiffLine = {
  kind: DiffLineKind;
  text: string;
  oldNum?: number;
  newNum?: number;
};

function isUnifiedDiff(content: string): boolean {
  return content.includes("\n@@") && (content.includes("\n---") || content.includes("\n+++"));
}

function parseUnifiedDiff(content: string): DiffLine[] {
  const result: DiffLine[] = [];
  let oldNum = 0;
  let newNum = 0;

  for (const raw of content.split("\n")) {
    if (raw.startsWith("@@")) {
      const match = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldNum = Number(match[1]);
        newNum = Number(match[2]);
      }
      result.push({ kind: "hunk", text: raw });
      continue;
    }
    if (raw.startsWith("---") || raw.startsWith("+++")) {
      result.push({ kind: "context", text: raw });
      continue;
    }
    if (raw.startsWith("+")) {
      result.push({ kind: "added", text: raw.slice(1), newNum });
      newNum++;
      continue;
    }
    if (raw.startsWith("-")) {
      result.push({ kind: "removed", text: raw.slice(1), oldNum });
      oldNum++;
      continue;
    }

    const text = raw.startsWith(" ") ? raw.slice(1) : raw;
    result.push({ kind: "context", text, oldNum, newNum });
    oldNum++;
    newNum++;
  }

  return result;
}

function parseAsAdded(content: string): DiffLine[] {
  return content.split("\n").map((text, index) => ({
    kind: "added",
    text,
    newNum: index + 1,
  }));
}

const PREFIX: Record<DiffLineKind, string> = {
  added: "+",
  removed: "-",
  context: " ",
  hunk: "",
};

export function DiffPreview({ content }: { content: string }) {
  const t = useTranslations("chat");
  const isBinary = isBinaryContent(content);
  const lines = useMemo(() => {
    if (isBinary) {
      return [];
    }
    return isUnifiedDiff(content) ? parseUnifiedDiff(content) : parseAsAdded(content);
  }, [content, isBinary]);

  if (isBinary) {
    return (
      <div className="ds-diff__binary" data-tool-result-view="diff">
        {t("binaryFile")}
      </div>
    );
  }

  return (
    <div className="ds-diff" data-tool-result-view="diff">
      {lines.map((line, index) => (
        <div
          className={`ds-diff__line ds-diff__line--${KIND_TO_VARIANT[line.kind]}`}
          data-diff-line={line.kind}
          data-new-num={line.newNum ?? ""}
          data-old-num={line.oldNum ?? ""}
          key={`${index}-${line.kind}-${line.text}`}
        >
          <span className="ds-diff__sym">{PREFIX[line.kind]}</span>
          <code>{line.kind === "hunk" ? line.text : line.text || "\u00A0"}</code>
        </div>
      ))}
    </div>
  );
}
