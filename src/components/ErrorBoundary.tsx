import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center h-screen bg-gray-50 p-4">
          <div className="w-full max-w-[400px] bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-red-500">error</span>
            </div>
            <h1 className="text-[15px] font-bold text-gray-900">Something went wrong</h1>
            <p className="text-[13px] text-gray-500 mt-1.5">
              An unexpected error occurred. Reloading usually fixes it.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 w-full py-2.5 bg-blue-600 text-white rounded-lg text-[13px] font-semibold hover:bg-blue-700 transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
