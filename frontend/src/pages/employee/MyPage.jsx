import { useState, useEffect, useCallback } from "react";
import api from "../../api";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../components/PageHeader";

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
      <div className="page-container empty-state">로딩 중...</div>
    );

  const renderRoleBadge = () => {
    if (userData.is_manager)
      return <span className="status-badge badge-primary">관리자 (보안망)</span>;
    if (
      userData.employee_number ||
      (userData.emp_code && userData.emp_code !== "-")
    )
      return <span className="status-badge badge-success">정규 사원 (일반망)</span>;
    return <span className="status-badge badge-gray">일반 회원 (제한적 접근)</span>;
  };

  return (
    <div className="page-container admin-page">
      <PageHeader
        title="개인 보안 현황"
        subtitle="기본 정보 수정 및 보안 인가 상태를 확인합니다."
      />
      <div className="panel-row">
        <div className="card dashboard-card card-fill">
          <div className="card-header has-divider">
            <h3 className="card-title">내 기본 정보</h3>
            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="btn-action btn-neutral btn-w-md btn-header"
              >
                정보 수정
              </button>
            )}
          </div>
          <div className="card-body-scroll">
            {!isEditing ? (
              <>
                <div className="info-row">
                  <span className="info-label">권한 등급</span>
                  <div className="info-value">{renderRoleBadge()}</div>
                </div>
                <div className="info-row">
                  <span className="info-label">이름</span>
                  <span className="info-value fw-bold text-title">{userData.name}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">로그인 ID</span>
                  <span className="tag tag-mono">
                    {userData.employee_id || userData.member_id}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">사원 번호</span>
                  <span className="info-value fw-bold text-primary">
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
                className="auth-form"
              >
                <div className="form-group">
                  <label className="form-label">이메일</label>
                  <input
                    type="email"
                    className="custom-input"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm({ ...editForm, email: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">연락처</label>
                  <input
                    type="text"
                    className="custom-input"
                    value={editForm.phone_number}
                    onChange={(e) =>
                      setEditForm({ ...editForm, phone_number: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">주소</label>
                  <input
                    type="text"
                    className="custom-input"
                    value={editForm.address}
                    onChange={(e) =>
                      setEditForm({ ...editForm, address: e.target.value })
                    }
                  />
                </div>
                <div className="dialog-actions">
                  <button
                    type="button"
                    className="btn-action btn-neutral btn-w-md btn-header"
                    onClick={() => setIsEditing(false)}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="btn-action btn-primary btn-w-md btn-header"
                  >
                    저장
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
        <div className="card dashboard-card card-fill">
          <div className="card-header has-divider">
            <h3 className="card-title">단말 네트워크 상태</h3>
          </div>
          <div className="card-body-scroll">
            <div className="info-row">
              <span className="info-label">외부 인터넷</span>
              <span className="status-badge badge-success">캡티브 포털 인증됨</span>
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
