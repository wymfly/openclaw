import { Fragment, useState, type ReactNode } from "react";
import "./json-tree.css";

export interface JsonTreeProps {
  /** Pre-parsed value (caller decides JSON.parse strategy). */
  value: unknown;
  /** Initial collapse depth. Nodes deeper than `defaultOpenDepth` start collapsed. Default: 2. */
  defaultOpenDepth?: number;
  className?: string;
  /** Aria-label for screen-readers. */
  "aria-label"?: string;
}

/**
 * Text atom: collapsible JSON tree. Caller pre-parses (atom does not own
 * JSON.parse error UI — wrap with caller-controlled error fallback).
 */
export function JsonTree({
  value,
  defaultOpenDepth = 2,
  className,
  "aria-label": ariaLabel,
}: JsonTreeProps) {
  const classes = ["ds-json"];
  if (className) {
    classes.push(className);
  }
  return (
    <div className={classes.join(" ")} aria-label={ariaLabel}>
      <JsonNode depth={0} value={value} defaultOpenDepth={defaultOpenDepth} />
    </div>
  );
}

function JsonNode({
  depth,
  value,
  defaultOpenDepth,
}: {
  depth: number;
  value: unknown;
  defaultOpenDepth: number;
}): ReactNode {
  if (value === null) {
    return <span className="ds-json__null">null</span>;
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return <span className="ds-json__primitive">{String(value)}</span>;
  }
  if (typeof value === "string") {
    return <span className="ds-json__string">&quot;{value}&quot;</span>;
  }
  if (Array.isArray(value)) {
    return (
      <CollapsibleNode
        bracket={["[", "]"]}
        defaultOpenDepth={defaultOpenDepth}
        depth={depth}
        entries={value as unknown[]}
        isArray
      />
    );
  }
  if (typeof value === "object") {
    return (
      <CollapsibleNode
        bracket={["{", "}"]}
        defaultOpenDepth={defaultOpenDepth}
        depth={depth}
        entries={Object.entries(value as Record<string, unknown>)}
      />
    );
  }
  return <span>{JSON.stringify(value)}</span>;
}

function CollapsibleNode({
  bracket,
  defaultOpenDepth,
  depth,
  entries,
  isArray,
}: {
  bracket: [string, string];
  defaultOpenDepth: number;
  depth: number;
  entries: unknown[] | [string, unknown][];
  isArray?: boolean;
}) {
  const [open, setOpen] = useState(depth < defaultOpenDepth);
  const summary = isArray ? `[${entries.length} items]` : `{${entries.length} keys}`;

  if (entries.length === 0) {
    return (
      <span>
        {bracket[0]}
        {bracket[1]}
      </span>
    );
  }

  return (
    <span className="ds-json__node">
      <button
        type="button"
        aria-expanded={open}
        className="ds-json__toggle"
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">{open ? "v" : ">"}</span>
        <span className="ds-json__summary">{summary}</span>
      </button>
      {open ? (
        <Fragment>
          <div className="ds-json__children">
            {(entries as unknown[]).map((entry, index) => {
              const isLast = index === entries.length - 1;
              if (isArray) {
                return (
                  <div key={index}>
                    <JsonNode defaultOpenDepth={defaultOpenDepth} depth={depth + 1} value={entry} />
                    {isLast ? null : <span>,</span>}
                  </div>
                );
              }
              const [key, childValue] = entry as [string, unknown];
              return (
                <div key={key}>
                  <span className="ds-json__key">&quot;{key}&quot;</span>
                  <span>: </span>
                  <JsonNode
                    defaultOpenDepth={defaultOpenDepth}
                    depth={depth + 1}
                    value={childValue}
                  />
                  {isLast ? null : <span>,</span>}
                </div>
              );
            })}
          </div>
          <span>{bracket[1]}</span>
        </Fragment>
      ) : null}
    </span>
  );
}
