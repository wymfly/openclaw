import { Component, type ReactNode } from "react";
import { AlertTriangleIcon, ChevronDownIcon, ChevronUpIcon, RotateCcwIcon } from "./icons";

type PanelErrorBoundaryLabels = {
  title: string;
  description: string;
  retry: string;
  details: string;
};

type PanelErrorBoundaryProps = {
  children?: ReactNode;
  labels: PanelErrorBoundaryLabels;
  resetKey?: string;
};

type PanelErrorBoundaryState = {
  error: Error | null;
  hasError: boolean;
  showDetails: boolean;
};

export class PanelErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  constructor(props: PanelErrorBoundaryProps) {
    super(props);
    this.state = { error: null, hasError: false, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<PanelErrorBoundaryState> {
    return { error, hasError: true };
  }

  componentDidUpdate(previousProps: PanelErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ error: null, hasError: false, showDetails: false });
    }
  }

  private retry = () => {
    this.setState({ error: null, hasError: false, showDetails: false });
  };

  private toggleDetails = () => {
    this.setState((current) => ({ showDetails: !current.showDetails }));
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { labels } = this.props;
    const { error, showDetails } = this.state;

    return (
      <section className="deck-ui-panel-error" data-testid="panel-error-boundary">
        <div className="deck-ui-panel-error-icon">
          <AlertTriangleIcon />
        </div>
        <h2>{labels.title}</h2>
        <p>{labels.description}</p>
        <div className="deck-ui-panel-error-actions">
          <button
            className="deckgo-button is-primary"
            data-testid="panel-error-retry"
            type="button"
            onClick={this.retry}
          >
            <RotateCcwIcon />
            {labels.retry}
          </button>
          <button
            className="deckgo-button"
            data-testid="panel-error-details"
            type="button"
            onClick={this.toggleDetails}
          >
            {labels.details}
            {showDetails ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </button>
        </div>
        {showDetails && error ? (
          <pre className="deckgo-code">{error.stack || error.message}</pre>
        ) : null}
      </section>
    );
  }
}
