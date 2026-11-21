// 하위 트리에서 렌더링 에러가 나도 앱 전체가 하얀 화면이 되지 않도록 막는 최상위 오류 경계
import { Component } from "react";

class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("렌더링 오류:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          background: "#0b1220",
          color: "#e5e7eb",
          fontFamily: "sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <h2 style={{ margin: 0 }}>화면을 표시하는 중 오류가 발생했습니다.</h2>
        <p style={{ margin: 0, color: "#9ca3af" }}>
          새로고침하면 대부분 복구됩니다. 문제가 계속되면 관리자에게 알려주세요.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: "10px 20px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          새로고침
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
