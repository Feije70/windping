"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "48px 24px", textAlign: "center",
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🌬️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1F354C", marginBottom: 8 }}>
            Er ging iets mis
          </div>
          <div style={{ fontSize: 13, color: "#8A9BB0", marginBottom: 24, maxWidth: 280 }}>
            {this.state.error?.message || "Probeer de pagina te vernieuwen."}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: "10px 24px", background: "#2E8FAE", color: "#fff",
              border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            Opnieuw proberen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
