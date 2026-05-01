import { forwardRef, type InputHTMLAttributes } from "react";
import "./slider.css";

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Required a11y label — slider has no visible text. */
  "aria-label": string;
}

/**
 * Form atom: native `<input type="range">` styled. Caller owns min/max/step/value.
 */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { className, ...rest },
  ref,
) {
  const classes = ["ds-slider"];
  if (className) {
    classes.push(className);
  }
  return <input ref={ref} type="range" className={classes.join(" ")} {...rest} />;
});
