// 가입 대기 목록을 검토하고 사원 승인 또는 반려 처리를 수행하는 관리자 전용 UI 컴포넌트

import { useState } from "react";

// 보호 도메인 제어와 AI 정책 이관·해제가 함께 쓰는 관리자 인증 창
function AdminAuthDialog({ title, target, danger = false, onSubmit, onCancel }) {
  const [adminId, setAdminId] = useState("admin");
  const [adminPw, setAdminPw] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ employee_id: adminId, password: adminPw });
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog-box">
        <h3 className="dialog-title">{title}</h3>
        <p className="dialog-desc">
          <strong>{target}</strong> 작업을 위해 관리자 인증을 진행해 주세요.
        </p>
        <form onSubmit={handleSubmit} className="dialog-form">
          <input
            type="text"
            className="custom-input"
            value={adminId}
            onChange={(e) => setAdminId(e.target.value)}
            placeholder="관리자 ID"
            required
          />
          <input
            type="password"
            className="custom-input"
            value={adminPw}
            onChange={(e) => setAdminPw(e.target.value)}
            placeholder="관리자 비밀번호"
            required
            autoFocus
          />
          <div className="dialog-actions">
            <button
              type="button"
              onClick={onCancel}
              className="btn-action btn-neutral btn-w-md btn-header"
            >
              취소
            </button>
            <button
              type="submit"
              className={`btn-action btn-w-lg btn-header ${danger ? "btn-danger" : "btn-primary"}`}
            >
              인증 및 적용
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminAuthDialog;
