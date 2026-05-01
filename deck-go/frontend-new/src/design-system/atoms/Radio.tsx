import { forwardRef, type InputHTMLAttributes } from "react";
import "./radio.css";

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Caller may supply visible label by composing `<label><Radio /> Label</label>` upstream. */
}

/**
 * Form atom: native `<input type="radio">` styled. For a group of radios,
 * caller owns the `name` shared between siblings + value handling.
 */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { className, ...rest },
  ref,
) {
  const classes = ["ds-radio"];
  if (className) {
    classes.push(className);
  }
  return <input ref={ref} type="radio" className={classes.join(" ")} {...rest} />;
});
