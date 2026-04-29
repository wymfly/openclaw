import "./diff-view.css";

export type DiffLineKind = "add" | "del" | "context" | "hunk";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

export interface DiffViewProps {
  /** Pre-parsed diff lines (preferred when caller already has structure). */
  lines?: DiffLine[];
  /** Raw unified diff string (parsed when `lines` is not provided). */
  content?: string;
  className?: string;
  /** Aria-label for the region. */
  "aria-label"?: string;
}

/**
 * Text atom: unified-diff renderer. Lines starting with `+`, `-` and `@@` are
 * styled add / del / hunk respectively; everything else is `context`.
 */
export function DiffView({ lines, content, className, "aria-label": ariaLabel }: DiffViewProps) {
  const parsed = lines ?? parseUnifiedDiff(content ?? "");
  const classes = ["ds-diff"];
  if (className) {
    classes.push(className);
  }
  return (
    <pre className={classes.join(" ")} aria-label={ariaLabel}>
      {parsed.map((line, index) => (
        <div className={`ds-diff__line ds-diff__line--${line.kind}`} key={index}>
          <span aria-hidden="true" className="ds-diff__sym">
            {symbolFor(line.kind)}
          </span>
          <code>{line.text}</code>
        </div>
      ))}
    </pre>
  );
}

function symbolFor(kind: DiffLineKind): string {
  switch (kind) {
    case "add":
      return "+";
    case "del":
      return "-";
    case "hunk":
      return "@";
    case "context":
      return " ";
    default:
      return " ";
  }
}

function parseUnifiedDiff(text: string): DiffLine[] {
  return text.split("\n").map((raw): DiffLine => {
    if (raw.startsWith("+++") || raw.startsWith("---")) {
      return { kind: "context", text: raw };
    }
    if (raw.startsWith("@@")) {
      return { kind: "hunk", text: raw };
    }
    if (raw.startsWith("+")) {
      return { kind: "add", text: raw.slice(1) };
    }
    if (raw.startsWith("-")) {
      return { kind: "del", text: raw.slice(1) };
    }
    return { kind: "context", text: raw };
  });
}
