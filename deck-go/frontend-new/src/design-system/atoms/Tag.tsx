import type { HTMLAttributes, ReactNode } from "react";
import "./tag.css";

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

/**
 * Status atom: small monospace tag (uppercase). Used for tool names,
 * model names, file extensions in transcript blocks.
 */
export function Tag({ className, children, ...rest }: TagProps) {
  const classes = ["ds-tag"];
  if (className) {
    classes.push(className);
  }
  return (
    <span className={classes.join(" ")} {...rest}>
      {children}
    </span>
  );
}
