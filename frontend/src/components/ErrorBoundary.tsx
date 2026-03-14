import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center bg-panel-bg">
          <div className="flex flex-col items-center gap-4 max-w-md px-6 py-8 bg-editor-bg border border-panel-border rounded-lg">
            <span className="material-symbols-outlined text-error text-4xl">error</span>
            <h2 className="text-text-primary text-lg font-semibold">
              Something went wrong
            </h2>
            <p className="text-text-muted text-sm text-center">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={this.handleReset}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent/15 text-accent rounded text-sm font-medium hover:bg-accent/25 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
