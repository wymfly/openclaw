import type { AriaRole, ReactNode } from "react";
import "./panel-cockpit.css";

export type PanelRootDensity = "regular" | "compact";
export type PanelSurfaceTone = "default" | "elevated" | "muted" | "warning";
export type PanelMetricTone = "default" | "positive" | "warning" | "danger";
export type PanelPillTone = "default" | "positive" | "warning" | "danger" | "accent";
export type PanelStatusRowAlign = "start" | "center" | "end";

type PanelElement = "article" | "div" | "main" | "section";
type SectionHeaderElement = "div" | "header";
type HeadingLevel = 2 | 3 | 4;
type HeadingTag = "h2" | "h3" | "h4";

interface SharedDomProps {
  id?: string;
  role?: AriaRole;
  hidden?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "data-testid"?: string;
}

export interface PanelRootProps extends SharedDomProps {
  children: ReactNode;
  as?: PanelElement;
  density?: PanelRootDensity;
}

export interface PanelSurfaceProps extends SharedDomProps {
  children: ReactNode;
  as?: PanelElement;
  tone?: PanelSurfaceTone;
}

export interface KpiStripProps extends SharedDomProps {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6 | "auto";
}

export interface PanelMetricProps extends SharedDomProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: PanelMetricTone;
}

export interface PanelSectionHeaderProps extends SharedDomProps {
  title: ReactNode;
  actions?: ReactNode;
  as?: SectionHeaderElement;
  description?: ReactNode;
  eyebrow?: ReactNode;
  headingLevel?: HeadingLevel;
  meta?: ReactNode;
}

export interface PanelStatusRowProps extends SharedDomProps {
  children: ReactNode;
  align?: PanelStatusRowAlign;
}

export interface PanelPillProps extends SharedDomProps {
  children: ReactNode;
  tone?: PanelPillTone;
}

export function PanelRoot({
  as = "section",
  children,
  density = "regular",
  hidden,
  id,
  role,
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "data-testid": testId,
}: PanelRootProps) {
  const Root = as;
  return (
    <Root
      aria-describedby={ariaDescribedBy}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className="ds-panel-root"
      data-density={density}
      data-testid={testId}
      hidden={hidden}
      id={id}
      role={role}
    >
      {children}
    </Root>
  );
}

export function PanelSurface({
  as = "section",
  children,
  hidden,
  id,
  role,
  tone = "default",
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "data-testid": testId,
}: PanelSurfaceProps) {
  const Surface = as;
  return (
    <Surface
      aria-describedby={ariaDescribedBy}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className="ds-panel-surface"
      data-testid={testId}
      data-tone={tone}
      hidden={hidden}
      id={id}
      role={role}
    >
      {children}
    </Surface>
  );
}

export function KpiStrip({
  children,
  columns = "auto",
  hidden,
  id,
  role,
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "data-testid": testId,
}: KpiStripProps) {
  return (
    <section
      aria-describedby={ariaDescribedBy}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className="ds-kpi-strip"
      data-columns={columns}
      data-testid={testId}
      hidden={hidden}
      id={id}
      role={role}
    >
      {children}
    </section>
  );
}

export function PanelMetric({
  hint,
  id,
  label,
  role,
  tone = "default",
  value,
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "data-testid": testId,
}: PanelMetricProps) {
  return (
    <article
      aria-describedby={ariaDescribedBy}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className="ds-panel-metric"
      data-testid={testId}
      data-tone={tone}
      id={id}
      role={role}
    >
      <span className="ds-panel-metric__label">{label}</span>
      <strong className="ds-panel-metric__value">{value}</strong>
      {hint ? <small className="ds-panel-metric__hint">{hint}</small> : null}
    </article>
  );
}

export function PanelSectionHeader({
  actions,
  as = "header",
  description,
  eyebrow,
  headingLevel = 2,
  hidden,
  id,
  meta,
  role,
  title,
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "data-testid": testId,
}: PanelSectionHeaderProps) {
  const Header = as;
  const Heading = `h${headingLevel}` as HeadingTag;
  return (
    <Header
      aria-describedby={ariaDescribedBy}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className="ds-panel-section-header"
      data-testid={testId}
      hidden={hidden}
      id={id}
      role={role}
    >
      <div className="ds-panel-section-header__main">
        {eyebrow ? <p className="ds-panel-section-header__eyebrow">{eyebrow}</p> : null}
        <div className="ds-panel-section-header__row">
          <Heading className="ds-panel-section-header__title">{title}</Heading>
          {meta ? <div className="ds-panel-section-header__meta">{meta}</div> : null}
        </div>
        {description ? <p className="ds-panel-section-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="ds-panel-section-header__actions">{actions}</div> : null}
    </Header>
  );
}

export function PanelStatusRow({
  align = "start",
  children,
  hidden,
  id,
  role,
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "data-testid": testId,
}: PanelStatusRowProps) {
  return (
    <div
      aria-describedby={ariaDescribedBy}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className="ds-panel-status-row"
      data-align={align}
      data-testid={testId}
      hidden={hidden}
      id={id}
      role={role}
    >
      {children}
    </div>
  );
}

export function PanelPill({
  children,
  hidden,
  id,
  role,
  tone = "default",
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "data-testid": testId,
}: PanelPillProps) {
  return (
    <span
      aria-describedby={ariaDescribedBy}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className="ds-panel-pill"
      data-testid={testId}
      data-tone={tone}
      hidden={hidden}
      id={id}
      role={role}
    >
      {children}
    </span>
  );
}
