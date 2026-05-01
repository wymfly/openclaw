import { useId, useState, type ReactNode } from "react";
import "./block.css";

export type BlockTone = "neutral" | "accent" | "thinking" | "error" | "warn";

export interface BlockProps {
  /** Header label (left side). Caller supplies all copy. */
  label: ReactNode;
  /** Optional header summary (single-line, ellipsized). */
  summary?: ReactNode;
  /** Optional header right-side content (e.g. tabs, buttons, badges). */
  headActions?: ReactNode;
  /** Body content; collapsible when `collapsible` is true. */
  children: ReactNode;
  /** When set, header is clickable and toggles body visibility. Default: false. */
  collapsible?: boolean;
  /** Initial open state for collapsible blocks. Default: true. */
  defaultOpen?: boolean;
  /** Controlled open state — pair with `onOpenChange`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Visual tone — adjusts border/header color. */
  tone?: BlockTone;
  /** When true, indicates the block is actively running (shimmer header). */
  running?: boolean;
  /** Remove body padding (e.g. when body is its own pre/code). */
  flushBody?: boolean;
  className?: string;
}

/**
 * Container atom: header + body block (the workhorse for tool_use / tool_result /
 * thinking / file blocks). Composes a collapsible disclosure when `collapsible`.
 *
 * a11y: header button gets `aria-expanded` + `aria-controls` when collapsible.
 */
export function Block({
  label,
  summary,
  headActions,
  children,
  collapsible = false,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  tone = "neutral",
  running = false,
  flushBody = false,
  className,
}: BlockProps) {
  const [internal, setInternal] = useState(defaultOpen);
  const open = openProp ?? internal;
  const bodyId = useId();

  function toggle(): void {
    const next = !open;
    if (openProp === undefined) {
      setInternal(next);
    }
    onOpenChange?.(next);
  }

  const classes = ["ds-block", `ds-block--${tone}`];
  if (running) {
    classes.push("ds-block--running");
  }
  if (className) {
    classes.push(className);
  }

  const headClasses = ["ds-block__head"];
  if (!collapsible) {
    headClasses.push("ds-block__head--static");
  }

  return (
    <div className={classes.join(" ")} data-running={running ? "true" : undefined}>
      {collapsible ? (
        <button
          type="button"
          className={headClasses.join(" ")}
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
        >
          <BlockHeadInner label={label} summary={summary} headActions={headActions} />
        </button>
      ) : (
        <div className={headClasses.join(" ")}>
          <BlockHeadInner label={label} summary={summary} headActions={headActions} />
        </div>
      )}
      {open ? (
        <div
          id={bodyId}
          className={flushBody ? "ds-block__body ds-block__body--flush" : "ds-block__body"}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function BlockHeadInner({
  label,
  summary,
  headActions,
}: {
  label: ReactNode;
  summary?: ReactNode;
  headActions?: ReactNode;
}) {
  return (
    <>
      <span className="ds-block__label">{label}</span>
      {summary !== undefined ? <span className="ds-block__summary">{summary}</span> : null}
      {headActions !== undefined ? <span className="ds-block__actions">{headActions}</span> : null}
    </>
  );
}
