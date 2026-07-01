"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Curio render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
          <span className="text-4xl">⚠️</span>
          <h2 className="text-xl font-bold text-stone-900">Something went wrong</h2>
          <p className="max-w-md text-sm text-stone-600">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("curio_profile_v2");
              localStorage.removeItem("curio_profile_v1");
              window.location.href = "/";
            }}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Reset app data & reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
