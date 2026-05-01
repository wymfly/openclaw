import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import "./file-input.css";

export interface FileInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Visible button label. Caller supplies copy. */
  children: ReactNode;
  /** When true, hides the chosen file name (caller handles attached-files UI separately). Default: true (composer attach pattern shows chips externally). */
  hideStatus?: boolean;
}

/**
 * Form atom: file picker disguised as a button. Caller owns multi-file,
 * accept-types, and the chip rendering of attached files.
 */
export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(function FileInput(
  { children, hideStatus = true, className, disabled, ...rest },
  ref,
) {
  const classes = ["ds-file-input"];
  if (disabled) {
    classes.push("ds-file-input--disabled");
  }
  if (className) {
    classes.push(className);
  }
  return (
    <label className={classes.join(" ")}>
      <span className="ds-file-input__label">{children}</span>
      <input
        ref={ref}
        type="file"
        className={hideStatus ? "ds-file-input__visually-hidden" : "ds-file-input__native"}
        disabled={disabled}
        {...rest}
      />
    </label>
  );
});
