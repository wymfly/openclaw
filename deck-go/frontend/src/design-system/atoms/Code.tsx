import "./code.css";

export interface CodeProps {
  /** Code content. */
  content: string;
  /** Language hint (sets `data-language`). */
  language?: string;
  /** Show line numbers (matches the bundle's `read` view). Default: false. */
  showLineNumbers?: boolean;
  /** Starting line number when `showLineNumbers`. Default: 1. */
  startLine?: number;
  /** Optional className. */
  className?: string;
  /** Aria-label (TS-required when content has no surrounding semantic context). */
  "aria-label"?: string;
}

/**
 * Text atom: monospace code block. Optional gutter line numbers; no syntax
 * highlighting (callers needing highlighting should compose with the existing
 * `panels/chat/blocks/HighlightedCodeView` until P3 brings highlighter in).
 */
export function Code({
  content,
  language,
  showLineNumbers = false,
  startLine = 1,
  className,
  "aria-label": ariaLabel,
}: CodeProps) {
  const classes = ["ds-code"];
  if (showLineNumbers) {
    classes.push("ds-code--numbered");
  }
  if (className) {
    classes.push(className);
  }

  if (!showLineNumbers) {
    return (
      <pre className={classes.join(" ")} data-language={language} aria-label={ariaLabel}>
        <code>{content}</code>
      </pre>
    );
  }

  const lines = content.split("\n");
  return (
    <pre className={classes.join(" ")} data-language={language} aria-label={ariaLabel}>
      {lines.map((line, index) => (
        <div className="ds-code__line" key={index}>
          <span aria-hidden="true" className="ds-code__ln">
            {startLine + index}
          </span>
          <code>{line}</code>
        </div>
      ))}
    </pre>
  );
}
