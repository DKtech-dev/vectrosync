import React from 'react';

/**
 * Last-resort guard: a runtime exception anywhere in the tree must never
 * white-screen the whole console. Renders a recoverable fault card that names
 * the failure instead of hiding it.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleRetry = this.handleRetry.bind(this);
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Catenary UI crashed:', error, info);
  }

  handleRetry() {
    this.setState({ error: null });
  }

  handleReload() {
    if (typeof window !== 'undefined') window.location.reload();
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas blueprint p-6">
        <section role="alert" aria-labelledby="fault-title" className="panel registered w-full max-w-lg overflow-hidden">
          <div className="panel-rail">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="icon-badge w-6 h-6 tone-critical">
                <span className="chip-dot" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 id="fault-title" className="panel-title truncate">
                  Render fault
                </h2>
                <p className="caption truncate">Client-side exception · this view was halted</p>
              </div>
            </div>
            <span className="pill tone-critical shrink-0">UI FAULT</span>
          </div>

          <div className="p-4 space-y-4">
            <div className="well p-3">
              <div className="eyebrow mb-1.5">Exception message</div>
              <p className="readout text-[11.5px] text-ink leading-relaxed break-words">
                {error?.message || 'An unexpected client-side error occurred.'}
              </p>
            </div>

            <p className="caption">
              Nothing was dispatched. The console holds no connection to field equipment, so a render fault
              cannot affect any process. Retry re-mounts this subtree with the last known state; reload
              re-fetches the model pass from scratch.
            </p>

            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-primary" onClick={this.handleRetry}>
                Retry render
              </button>
              <button type="button" className="btn btn-ghost" onClick={this.handleReload}>
                Reload console
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }
}

export default ErrorBoundary;
