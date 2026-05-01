import { forwardRef, type TextareaHTMLAttributes } from "react";
import "./textarea.css";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  /** When true, removes the resize handle (composer/textarea fields auto-grow). */
  noResize?: boolean;
}

/**
 * Form atom: multi-line text input. Used by chat composer and any free-form
 * editor. Caller owns auto-grow if needed (sets style.height from a hook).
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, noResize, className, ...rest },
  ref,
) {
  const classes = ["ds-textarea"];
  if (invalid) {
    classes.push("ds-textarea--invalid");
  }
  if (noResize) {
    classes.push("ds-textarea--no-resize");
  }
  if (className) {
    classes.push(className);
  }
  return (
    <textarea
      ref={ref}
      className={classes.join(" ")}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});
