import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import "./button.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

/**
 * Action atom: text button with 4 variants × 2 sizes. No hardcoded strings —
 * caller supplies `children`. Defaults `type="button"` to avoid accidental
 * form submission. Supports `aria-pressed` for toggle buttons via spread.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, children, type, ...rest },
  ref,
) {
  const classes = ["ds-button", `ds-button--${variant}`];
  if (size === "sm") {
    classes.push("ds-button--sm");
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
