import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { ButtonSize, ButtonVariant } from "./Button";
import "./icon-button.css";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** REQUIRED accessible name for the icon-only control. */
  "aria-label": string;
  children: ReactNode;
}

/**
 * Action atom: square icon-only button. `aria-label` is required by the
 * TypeScript signature so consumers cannot ship an icon-only control without
 * an accessible name.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = "ghost", size = "md", className, children, type, ...rest },
  ref,
) {
  const classes = ["ds-icon-button", `ds-icon-button--${variant}`];
  if (size === "sm") {
    classes.push("ds-icon-button--sm");
  }
  if (className) {
    classes.push(className);
  }
  return (
    <button ref={ref} type={type ?? "button"} className={classes.join(" ")} {...rest}>
      {children}
    </button>
  );
});
