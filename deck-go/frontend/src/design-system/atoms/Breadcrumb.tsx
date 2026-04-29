import { Fragment, type ReactNode } from "react";
import "./breadcrumb.css";

export interface BreadcrumbItem {
  /** Visible label. Caller supplies copy. */
  label: ReactNode;
  /** When provided, item renders as a link. Plain text otherwise (terminal segment). */
  href?: string;
  /** Click handler — fires before navigation; useful for SPA routing. */
  onClick?: () => void;
}

export interface BreadcrumbProps {
  items: ReadonlyArray<BreadcrumbItem>;
  /** Visible separator between items. Default: `/`. */
  separator?: ReactNode;
  /** Aria-label for the nav region. Default: `Breadcrumb`. */
  "aria-label"?: string;
  className?: string;
}

/**
 * Navigation atom: breadcrumb trail. Wraps items in a `<nav>` with `<ol>`. The
 * last item is rendered without a link (current page). Caller supplies all
 * copy.
 */
export function Breadcrumb({
  items,
  separator = "/",
  "aria-label": ariaLabel = "Breadcrumb",
  className,
}: BreadcrumbProps) {
  const classes = ["ds-breadcrumb"];
  if (className) {
    classes.push(className);
  }
  return (
    <nav aria-label={ariaLabel} className={classes.join(" ")}>
      <ol className="ds-breadcrumb__list">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <Fragment key={index}>
              <li className="ds-breadcrumb__item">
                {last || !item.href ? (
                  <span aria-current={last ? "page" : undefined}>{item.label}</span>
                ) : (
                  <a href={item.href} onClick={item.onClick} className="ds-breadcrumb__link">
                    {item.label}
                  </a>
                )}
              </li>
              {last ? null : (
                <li aria-hidden="true" className="ds-breadcrumb__sep">
                  {separator}
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
