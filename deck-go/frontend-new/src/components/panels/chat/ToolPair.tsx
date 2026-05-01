import type { ReactNode } from "react";
import "./tool-pair.css";

export interface ToolPairProps {
  /** ToolUseCard rendering (top half of paired card). */
  toolUse: ReactNode;
  /** ToolResultCard rendering (bottom half) — may be undefined while streaming. */
  toolResult?: ReactNode;
  /** When true, renders tool_use + tool_result as a single bordered card with shared shell. */
  paired?: boolean;
  /** When the tool_result reported an error — applies error tone to the shared border. */
  error?: boolean;
}

/**
 * Transcript helper: groups a tool_use + tool_result pair into a single visual
 * card with a shared border (paired mode), or stacks them split-style with
 * each child rendering its own border (split mode — fallback / preference).
 *
 * Visual baseline: bundle "tool ladder" pair card. The wrapper itself owns
 * the border + tone; children should render as `paired={true}` so they
 * suppress their own borders to avoid double-stroke.
 */
export function ToolPair({ toolUse, toolResult, paired = true, error = false }: ToolPairProps) {
  if (!paired) {
    return (
      <div className="ds-tool-pair ds-tool-pair--split">
        {toolUse}
        {toolResult ?? null}
      </div>
    );
  }

  const classes = ["ds-tool-pair", "ds-tool-pair--paired"];
  if (error) {
    classes.push("ds-tool-pair--error");
  }

  return (
    <div className={classes.join(" ")} data-tool-pair="true" data-tool-error={error || undefined}>
      <div className="ds-tool-pair__use">{toolUse}</div>
      {toolResult ? (
        <>
          <div className="ds-tool-pair__divider" aria-hidden="true" />
          <div className="ds-tool-pair__result">{toolResult}</div>
        </>
      ) : null}
    </div>
  );
}
