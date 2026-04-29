import { forwardRef, type ButtonHTMLAttributes } from "react";
import "./toggle.css";

export interface ToggleProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange" | "type"
> {
  /** Controlled checked state. */
  checked: boolean;
  /** Called with the next value when user clicks. */
  onCheckedChange: (next: boolean) => void;
  /** Required a11y label — toggle has no visible text. */
  "aria-label": string;
}

/**
 * Form atom: switch (`role="switch"`). Stateless — caller owns checked state.
 * Click + Space + Enter toggle. Disabled state honored.
 */
export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  {
    checked,
    onCheckedChange,
    disabled,
    className,
    "aria-label": ariaLabel,
    onClick,
    onKeyDown,
    ...rest
  },
  ref,
) {
  const classes = ["ds-toggle"];
  if (checked) {
    classes.push("ds-toggle--on");
  }
  if (className) {
    classes.push(className);
  }
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={classes.join(" ")}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !disabled) {
          onCheckedChange(!checked);
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || disabled) {
          return;
        }
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          onCheckedChange(!checked);
        }
      }}
      {...rest}
    >
      <span aria-hidden="true" className="ds-toggle__thumb" />
    </button>
  );
});
