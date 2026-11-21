import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(err: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: err.message || 'An unexpected application error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white">Workshop Sync Notice</h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Something interrupted the workshop connection. Reload to reconnect cleanly.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold cursor-pointer"
            >
              Reload Workshop
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
