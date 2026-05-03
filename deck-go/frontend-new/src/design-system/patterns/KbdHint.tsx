import "./kbd-hint.css";

export interface KbdHintProps {
  /** Sequence of keys (e.g. `["⌘", "K"]`). Each renders as its own chip. */
  keys: string[];
  /** Visual size. `sm` (default) for inline hints, `md` for highlight strips. */
  size?: "sm" | "md";
  /** Optional accessible label. Defaults to a joined string of keys with " ". */
  "aria-label"?: string;
}

/**
 * Pattern: KbdHint — visible keyboard shortcut chips. Renders one chip per key
 * with a small gap (no `+` glyph; the gap implies sequence/combination).
 *
 * Used inline next to commands ("Save  ⌘ S"), in search inputs ("⌘ K"), and
 * in command palette previews. Pair with `aria-keyshortcuts` on the parent
 * actionable element so the shortcut is announced.
 */
export function KbdHint({ keys, size = "sm", "aria-label": ariaLabel }: KbdHintProps) {
  const accessibleLabel = ariaLabel ?? keys.join(" ");
  return (
    <span className={`ds-kbd-hint ds-kbd-hint--${size}`} aria-label={accessibleLabel}>
      {keys.map((key, index) => (
        <kbd key={`${key}-${index}`} className="ds-kbd-hint__key">
          {key}
        </kbd>
      ))}
    </span>
  );
}
