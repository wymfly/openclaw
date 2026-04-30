import { forwardRef, type InputHTMLAttributes } from "react";
import "./input.css";

export type InputSize = "sm" | "md";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  inputSize?: InputSize;
  /** Error variant — paired with `aria-invalid` and accent border. */
  invalid?: boolean;
}

/**
 * Form atom: single-line text input. Caller provides label and id (this atom
 * has no label slot — pair with caller-supplied `<label htmlFor>` upstream).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { inputSize = "md", invalid, className, type, ...rest },
  ref,
) {
  const classes = ["ds-input"];
  if (inputSize === "sm") {
    classes.push("ds-input--sm");
  }
  if (invalid) {
    classes.push("ds-input--invalid");
  }
  if (className) {
    classes.push(className);
  }
  return (
    <input
      ref={ref}
      type={type ?? "text"}
      className={classes.join(" ")}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});
