"use client";

import { AlertTriangle, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Change this key to reset the boundary (e.g. on panel switch). */
  resetKey?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

/**
 * Panel-level error boundary.
 * Catches JS errors inside a panel and renders a fallback UI
 * so other panels remain functional.
 *
 * i18n note: this is a class component and cannot use hooks.
 * Strings are kept minimal and hardcoded (error boundaries are
 * last-resort UI — i18n failure shouldn't break them too).
 * The page-level wrapper passes translated strings via the
 * panelError namespace for the normal error display path.
 */
export class PanelErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[PanelErrorBoundary]", error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null, showDetails: false });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, showDetails: false });
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, showDetails } = this.state;

    return (
      <div
        data-testid="panel-error-boundary"
        className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center"
      >
        <div className="text-[var(--destructive)]">
          <AlertTriangle size={40} strokeWidth={1.5} />
        </div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Something went wrong</h3>
        <p className="text-xs text-[var(--muted-foreground)] max-w-[360px]">
          This panel encountered an error. Other panels are unaffected.
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={this.handleRetry}
            data-testid="panel-error-retry"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
          >
            <RotateCcw size={12} />
            Retry
          </button>
          <button
            type="button"
            onClick={this.toggleDetails}
            data-testid="panel-error-details"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors hover:bg-[var(--accent)]"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
          >
            Details
            {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {showDetails && error && (
          <pre
            className="mt-2 max-w-[480px] max-h-[160px] overflow-auto text-left text-[10px] p-3 rounded-md"
            style={{
              backgroundColor: "var(--muted)",
              color: "var(--muted-foreground)",
              border: "1px solid var(--border)",
            }}
          >
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        )}
      </div>
    );
  }
}
