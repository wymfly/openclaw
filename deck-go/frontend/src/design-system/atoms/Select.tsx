import { forwardRef, type SelectHTMLAttributes } from "react";
import "./select.css";

export type SelectSize = "sm" | "md";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  selectSize?: SelectSize;
  invalid?: boolean;
}

/**
 * Form atom: native `<select>` styled with design-system tokens. Caller owns
 * `<option>` children. Use this for simple choose-one lists where a popover is
 * overkill (channels, language, model name).
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { selectSize = "md", invalid, className, children, ...rest },
  ref,
) {
  const classes = ["ds-select"];
  if (selectSize === "sm") {
    classes.push("ds-select--sm");
  }
  if (invalid) {
    classes.push("ds-select--invalid");
  }
  if (className) {
    classes.push(className);
  }
  return (
    <select ref={ref} className={classes.join(" ")} aria-invalid={invalid || undefined} {...rest}>
      {children}
    </select>
  );
});
