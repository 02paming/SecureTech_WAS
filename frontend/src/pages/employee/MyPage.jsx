import { useState, useEffect, useCallback } from "react";
import api from "../../api";
import { useNavigate } from "react-router-dom";

const MyPage = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    email: "",
    phone_number: "",
    address: "",
    newPassword: "",
    newPasswordConfirm: "",
  });

  const formatPhone = (p) => {
    if (!p) return "-";
    const clean = String(p).replace(/[^0-9]/g, "");
    if (clean.length === 11)
      return clean.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
    if (clean.length === 10)
      return clean.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
    return p;
  };

  const fetchMyInfo = useCallback(async (employeeId) => {
    try {
      const res = await api.post(`/api/auth/my-info/`, {
        employee_id: employeeId,
      });
      const savedUser = JSON.parse(sessionStorage.getItem("user") || "{}");
      if (res.data?.status === "success" && res.data.data) {
        const mergedData = { ...savedUser, ...res.data.data };
        setUserData(mergedData);
        setEditForm({
          email: mergedData.email,
          phone_number: mergedData.phone_number,
          address: mergedData.address,
          newPassword: "",
          newPasswordConfirm: "",
        });
        sessionStorage.setItem("user", JSON.stringify(mergedData));
      } else setUserData(savedUser);
    } catch {
      setUserData(JSON.parse(sessionStorage.getItem("user") || "{}"));
    }
  }, []);

  useEffect(() => {
    const savedUser = sessionStorage.getItem("user");
    if (!savedUser) {
      alert("로그인이 필요합니다.");
      navigate("/");
      return;
    }
    setTimeout(() => {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUserData(parsedUser);
        if (parsedUser.employee_id || parsedUser.member_id || parsedUser.emp_id)
          fetchMyInfo(
            parsedUser.employee_id || parsedUser.member_id || parsedUser.emp_id,
          );
        setLoading(false);
      } catch {
        navigate("/");
      }
    }, 0);
  }, [navigate, fetchMyInfo]);

  if (loading || !userData)
    return (
      <div
        className="page-container"
        style={{
          textAlign: "center",
          padding: "100px 0",
          color: "var(--text-muted)",
        }}
      >
        로딩 중...
      </div>
    );

  const renderRoleBadge = () => {
    if (userData.is_manager)
      return (
        <span
          className="badge badge-blue"
          style={{ fontSize: "13px", padding: "6px 14px" }}
        >
          관리자 (보안망)
        </span>
      );
    if (
      userData.employee_number ||
      (userData.emp_code && userData.emp_code !== "-")
    )
      return (
        <span
          className="badge badge-green"
          style={{ fontSize: "13px", padding: "6px 14px" }}
        >
          정규 사원 (일반망)
        </span>
      );
    return (
      <span
        className="badge badge-gray"
        style={{ fontSize: "13px", padding: "6px 14px" }}
      >
        일반 회원 (제한적 접근)
      </span>
    );
  };

  return (
    <div className="page-container admin-page">
      <style>{`
        .mypage-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; flex: 1; min-height: 0; }
        .info-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-bottom: 1px solid var(--border-color); }
        .info-row:last-child { border-bottom: none; }
        .info-label { font-size: 14px; font-weight: 600; color: var(--text-muted); min-width: 100px; }
        .info-value { font-size: 15px; color: var(--text-main); text-align: right; }
        @media (max-width: 768px) { .mypage-layout { grid-template-columns: 1fr; height: auto; } }
      `}</style>
      <div
        className="page-header"
        style={{ flexShrink: 0, marginBottom: "20px" }}
      >
        <h2 className="page-title">🛡️ 개인 보안 현황 (My Page)</h2>
        <p className="page-subtitle">
          기본 정보 수정 및 보안 인가 상태를 확인합니다.
        </p>
      </div>
      <div className="mypage-layout">
        <div
          className="card"
          style={{
            margin: 0,
            display: "flex",
            flexDirection: "column",
            padding: "24px",
          }}
        >
          <div
            className="card-header"
            style={{
              borderBottom: "1px solid var(--border-color)",
              paddingBottom: "16px",
              marginBottom: "20px",
              flexShrink: 0,
            }}
          >
            <h3 className="card-title">👤 내 기본 정보</h3>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="btn-action btn-action-edit"
                style={{
                  height: "36px",
                  padding: "0 16px",
                  fontSize: "13px",
                  fontWeight: "bold",
                }}
              >
                ✏️ 정보 수정
              </button>
            )}
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {!isEditing ? (
              <>
                <div className="info-row">
                  <span className="info-label">권한 등급</span>
                  <div className="info-value">{renderRoleBadge()}</div>
                </div>
                <div className="info-row">
                  <span className="info-label">이름</span>
                  <span
                    className="info-value"
                    style={{
                      fontWeight: "bold",
                      color: "var(--text-title)",
                      fontSize: "16px",
                    }}
                  >
                    {userData.name}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">로그인 ID</span>
                  <span
                    className="ip-badge"
                    style={{ fontSize: "14px", padding: "4px 10px" }}
                  >
                    {userData.employee_id || userData.member_id}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">사원 번호</span>
                  <span
                    className="info-value"
                    style={{
                      color: "var(--color-primary)",
                      fontWeight: "bold",
                    }}
                  >
                    {userData.emp_code && userData.emp_code !== "-"
                      ? userData.emp_code
                      : "미부여"}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">이메일</span>
                  <span className="info-value">
                    {userData.email || "미입력"}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">연락처</span>
                  <span className="info-value">
                    {formatPhone(userData.phone_number) || "미입력"}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">거주지 주소</span>
                  <span className="info-value">
                    {userData.address || "미입력"}
                  </span>
                </div>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  alert("저장 로직 생략됨");
                  setIsEditing(false);
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <div>
                  <label className="info-label">이메일</label>
                  <input
                    type="email"
                    className="custom-input"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm({ ...editForm, email: e.target.value })
                    }
                    style={{ width: "100%", padding: "12px", marginTop: "6px" }}
                  />
                </div>
                <div>
                  <label className="info-label">연락처</label>
                  <input
                    type="text"
                    className="custom-input"
                    value={editForm.phone_number}
                    onChange={(e) =>
                      setEditForm({ ...editForm, phone_number: e.target.value })
                    }
                    style={{ width: "100%", padding: "12px", marginTop: "6px" }}
                  />
                </div>
                <div>
                  <label className="info-label">주소</label>
                  <input
                    type="text"
                    className="custom-input"
                    value={editForm.address}
                    onChange={(e) =>
                      setEditForm({ ...editForm, address: e.target.value })
                    }
                    style={{ width: "100%", padding: "12px", marginTop: "6px" }}
                  />
                </div>
                <div
                  style={{ display: "flex", gap: "10px", marginTop: "20px" }}
                >
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ flex: 1, height: "42px" }}
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    className="btn-action btn-action-cancel"
                    onClick={() => setIsEditing(false)}
                    style={{ flex: 1, height: "42px" }}
                  >
                    취소
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
        <div
          className="card"
          style={{
            margin: 0,
            borderTop: "4px solid var(--color-primary)",
            display: "flex",
            flexDirection: "column",
            padding: "24px",
          }}
        >
          <div
            className="card-header"
            style={{
              borderBottom: "1px solid var(--border-color)",
              paddingBottom: "16px",
              marginBottom: "20px",
              flexShrink: 0,
            }}
          >
            <h3
              className="card-title"
              style={{ color: "var(--color-primary)" }}
            >
              🌐 단말 네트워크 상태
            </h3>
          </div>
          <div>
            <div className="info-row">
              <span className="info-label">외부 인터넷</span>
              <div className="info-value">
                <span
                  style={{
                    color: "var(--color-success)",
                    fontWeight: "bold",
                    fontSize: "16px",
                  }}
                >
                  🟢 캡티브 포털 인증됨
                </span>
              </div>
            </div>
            <div className="info-row">
              <span className="info-label">최근 로그인</span>
              <span className="info-value">
                {new Date().toLocaleString("ko-KR")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default MyPage;
