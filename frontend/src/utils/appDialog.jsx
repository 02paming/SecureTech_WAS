// 브라우저 기본 알림창 대신 앱 내 공통 다이얼로그 스타일로 alert 및 confirm을 처리하는 전역 컴포넌트

/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";

// 네이티브 alert/confirm 대신 패턴 라이브러리 dialog-box 스타일로 띄우는 전역 창.
// listener는 AppDialogHost 하나만 마운트된다는 전제로 모듈 범위에 둔다 (컨텍스트 없이 어디서든 호출하기 위함).
let listener = null;

export function appAlert(message) {
  return new Promise((resolve) => {
    if (!listener) {
      resolve();
      return;
    }
    listener({ type: "alert", message, resolve });
  });
}

export function appConfirm(message) {
  return new Promise((resolve) => {
    if (!listener) {
      resolve(false);
      return;
    }
    listener({ type: "confirm", message, resolve });
  });
}

export function AppDialogHost() {
  const [request, setRequest] = useState(null);

  useEffect(() => {
    listener = (req) => setRequest(req);
    return () => {
      listener = null;
    };
  }, []);

  if (!request) return null;

  const close = (result) => {
    request.resolve(result);
    setRequest(null);
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog-box">
        <p className="dialog-desc dialog-message">{request.message}</p>
        <div className="dialog-actions">
          {request.type === "confirm" && (
            <button
              type="button"
              className="btn-action btn-neutral btn-w-md btn-header"
              onClick={() => close(false)}
            >
              취소
            </button>
          )}
          <button
            type="button"
            className="btn-action btn-primary btn-w-md btn-header"
            onClick={() => close(request.type === "confirm" ? true : undefined)}
            autoFocus
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
