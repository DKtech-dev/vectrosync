import React from 'react';

/**
 * Last-resort guard: a runtime exception anywhere in the tree must never
 * white-screen the whole console. Renders a recoverable card instead.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Catenary UI crashed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-canvas p-6">
          <div className="card p-6 max-w-md w-full">
            <h2 className="card-title mb-2">Something went wrong rendering this view</h2>
            <p className="caption mb-4">
              {this.state.error?.message || 'An unexpected client-side error occurred.'}
            </p>
            <button type="button" className="btn btn-primary px-4 py-2" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
