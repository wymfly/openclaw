import type { CSSProperties, HTMLAttributes } from "react";
import "./skeleton-loader.css";

export interface SkeletonLoaderProps extends HTMLAttributes<HTMLDivElement> {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
}

/**
 * Status atom: shimmer placeholder block. `aria-hidden` so screen readers
 * skip — pair with a parent `aria-busy="true"` on the loading container.
 * Respects `prefers-reduced-motion`.
 */
export function SkeletonLoader({ width, height, className, style, ...rest }: SkeletonLoaderProps) {
  const classes = ["ds-skeleton"];
  if (className) {
    classes.push(className);
  }
  return (
    <div aria-hidden className={classes.join(" ")} style={{ width, height, ...style }} {...rest} />
  );
}
