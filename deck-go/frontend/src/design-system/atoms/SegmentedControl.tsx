import { useRef, type ReactNode } from "react";
import { useKeyboardNav } from "../hooks/use-keyboard-nav";
import "./segmented-control.css";

export interface SegmentedItem<TValue extends string> {
  value: TValue;
  label: ReactNode;
  disabled?: boolean;
  /** Optional aria-controls — id of the panel this segment shows. */
  controls?: string;
}

export interface SegmentedControlProps<TValue extends string> {
  /** Array of segments — order matters for ArrowKey nav. */
  items: ReadonlyArray<SegmentedItem<TValue>>;
  /** Current selected value. */
  value: TValue;
  /** Called when user picks a different segment. */
  onChange: (next: TValue) => void;
  /** Required group name for screen-readers. */
  "aria-label": string;
  /** Visual size; tabs in tool-result use `xs` (compact). Default: `sm`. */
  controlSize?: "xs" | "sm";
  className?: string;
}

/**
 * Navigation atom: tab-strip with single-select. Use for tool-result tabs
 * (raw / bash / read / diff), composer mode toggles, etc.
 *
 * a11y: `role="tablist"` + each segment is `role="tab"` with `aria-selected`.
 * Disabled segments are skipped by ArrowKey nav.
 */
export function SegmentedControl<TValue extends string>({
  items,
  value,
  onChange,
  controlSize = "sm",
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<TValue>) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeIndex = items.findIndex((item) => item.value === value);

  const onKeyDown = useKeyboardNav({
    items,
    activeIndex,
    onActiveIndexChange: (next) => {
      const item = items[next];
      if (item) {
        onChange(item.value);
        // Move focus to the newly active tab so screen-readers announce.
        const tabs = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        tabs?.[next]?.focus();
      }
    },
    orientation: "horizontal",
    loop: false,
  });

  const classes = ["ds-segmented", `ds-segmented--${controlSize}`];
  if (className) {
    classes.push(className);
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={classes.join(" ")}
      onKeyDown={onKeyDown}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={item.controls}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            className={
              selected ? "ds-segmented__tab ds-segmented__tab--active" : "ds-segmented__tab"
            }
            onClick={() => {
              if (!item.disabled) {
                onChange(item.value);
              }
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
