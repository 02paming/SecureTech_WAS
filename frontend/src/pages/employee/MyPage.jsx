// 사원이 본인의 기본 정보, 연락처, 네트워크 인증 상태를 확인하고 정보를 수정하는 마이페이지 UI 컴포넌트

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import PageHeader from "../../components/PageHeader";
import { appAlert } from "../../utils/appDialog";

const MyPage = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);
  const [editForm, setEditForm] = useState({
    email: "",
    phone_number: "",
    address: "",
    currentPassword: "",
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
        sessionStorage.setItem("user", JSON.stringify(mergedData));
      } else setUserData(savedUser);
    } catch {
      setUserData(JSON.parse(sessionStorage.getItem("user") || "{}"));
    }
  }, []);

  useEffect(() => {
    const savedUser = sessionStorage.getItem("user");
    if (!savedUser) {
      (async () => {
        await appAlert("로그인이 필요합니다.");
        navigate("/");
      })();
      return;
    }
    const timer = setTimeout(() => {
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
    return () => clearTimeout(timer);
  }, [navigate, fetchMyInfo]);

  if (loading || !userData)
    return (
      <div className="page-container empty-state">페이지를 불러오는 중입니다...</div>
    );

  const renderRoleBadge = () => {
    if (userData.is_manager)
      return <span className="status-badge badge-primary">관리자</span>;
    if (
      userData.employee_number ||
      (userData.emp_code && userData.emp_code !== "-")
    )
      return <span className="status-badge badge-success">일반 사원</span>;
    return <span className="status-badge badge-gray">일반 회원</span>;
  };

  const employeeId =
    userData.employee_id || userData.member_id || userData.emp_id;

  const handleEditStart = () => {
    setEditForm({
      email: userData.email || "",
      phone_number: formatPhone(userData.phone_number),
      address: userData.address || "",
      currentPassword: "",
      newPassword: "",
      newPasswordConfirm: "",
    });
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowNewPasswordConfirm(false);
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (editForm.newPassword !== editForm.newPasswordConfirm) {
      await appAlert("새 비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.put(`/api/auth/profile/`, {
        employee_id: employeeId,
        email: editForm.email,
        phone_number: editForm.phone_number,
        address: editForm.address,
        current_password: editForm.currentPassword,
        new_password: editForm.newPassword,
      });
      await appAlert(res.data.message);
      setIsEditing(false);
      fetchMyInfo(employeeId);
    } catch (err) {
      await appAlert(err.response?.data?.message || "정보 수정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleFormChange = (e) =>
    setEditForm({ ...editForm, [e.target.name]: e.target.value });

  return (
    <div className="page-container page-narrow">
      <PageHeader
        title="마이페이지"
        subtitle="개인정보를 확인하고 연락처와 비밀번호를 수정합니다."
      />
      <div className="mypage-grid">
        <div className="card">
          <div className="card-header has-divider">
            <div>
              <h3 className="card-title">기본 정보</h3>
              <p className="card-subtitle">변경이 필요하면 관리자에게 요청하세요.</p>
            </div>
          </div>
          <div className="info-rows">
            <div className="info-row">
              <span className="info-label">권한</span>
              <div className="info-value">{renderRoleBadge()}</div>
            </div>
            <div className="info-row">
              <span className="info-label">이름</span>
              <span className="info-value fw-bold text-title">{userData.name}</span>
            </div>
            <div className="info-row">
              <span className="info-label">아이디</span>
              <span className="tag tag-mono">{employeeId}</span>
            </div>
            <div className="info-row">
              <span className="info-label">사번</span>
              <span className="info-value fw-bold text-primary">
                {userData.emp_code && userData.emp_code !== "-"
                  ? userData.emp_code
                  : "미부여"}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">입사일</span>
              <span className="info-value">{userData.hire_date || "-"}</span>
            </div>
            <div className="info-row">
              <span className="info-label">생년월일</span>
              <span className="info-value">{userData.birth_date || "-"}</span>
            </div>
            <div className="info-row">
              <span className="info-label">주민등록번호</span>
              <span className="info-value">{userData.jumin_no || "-"}</span>
            </div>
          </div>
        </div>

        <div className="panel-col">
          <div className="card">
            <div className="card-header has-divider">
              <h3 className="card-title">연락처 정보</h3>
              <button
                type="button"
                onClick={handleEditStart}
                className="btn-action btn-neutral btn-w-md btn-header"
              >
                정보 수정
              </button>
            </div>
            <div className="info-rows">
              <div className="info-row">
                <span className="info-label">이메일</span>
                <span className="info-value">{userData.email || "미입력"}</span>
              </div>
              <div className="info-row">
                <span className="info-label">연락처</span>
                <span className="info-value">
                  {formatPhone(userData.phone_number)}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">주소</span>
                <span className="info-value">{userData.address || "미입력"}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header has-divider">
              <h3 className="card-title">네트워크 인증 상태</h3>
            </div>
            <div className="info-rows">
              <div className="info-row">
                <span className="info-label">인증 상태</span>
                {userData.network_authenticated ? (
                  <span className="status-badge badge-success">인증 완료</span>
                ) : (
                  <span className="status-badge badge-gray">미인증</span>
                )}
              </div>
              <div className="info-row">
                <span className="info-label">접속 IP</span>
                <span className="info-value">{userData.network_ip || "-"}</span>
              </div>
              <div className="info-row">
                <span className="info-label">인증 시간</span>
                <span className="info-value">{userData.network_auth_time || "-"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="dialog-overlay">
          <div className="dialog-box dialog-md">
            <h3 className="dialog-title">정보 수정</h3>
            <form onSubmit={handleSave} className="auth-form">
              <div className="form-group">
                <label className="form-label">이메일</label>
                <input
                  type="email"
                  name="email"
                  className="custom-input"
                  value={editForm.email}
                  onChange={handleFormChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">연락처</label>
                <input
                  type="text"
                  name="phone_number"
                  className="custom-input"
                  value={editForm.phone_number}
                  onChange={handleFormChange}
                  maxLength={13}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">주소</label>
                <input
                  type="text"
                  name="address"
                  className="custom-input"
                  value={editForm.address}
                  onChange={handleFormChange}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    새 비밀번호<span className="form-hint">(변경 시에만)</span>
                  </label>
                  <div className="input-with-btn">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      name="newPassword"
                      autoComplete="new-password"
                      className="custom-input"
                      value={editForm.newPassword}
                      onChange={handleFormChange}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="btn-action btn-neutral btn-w-sm btn-form"
                    >
                      {showNewPassword ? "숨김" : "보기"}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">새 비밀번호 확인</label>
                  <div className="input-with-btn">
                    <input
                      type={showNewPasswordConfirm ? "text" : "password"}
                      name="newPasswordConfirm"
                      autoComplete="new-password"
                      className="custom-input"
                      value={editForm.newPasswordConfirm}
                      onChange={handleFormChange}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPasswordConfirm((v) => !v)}
                      className="btn-action btn-neutral btn-w-sm btn-form"
                    >
                      {showNewPasswordConfirm ? "숨김" : "보기"}
                    </button>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">
                  현재 비밀번호 <span className="text-danger">*</span>
                </label>
                <div className="input-with-btn">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    name="currentPassword"
                    autoComplete="current-password"
                    className="custom-input"
                    placeholder="저장하려면 현재 비밀번호를 입력하세요."
                    value={editForm.currentPassword}
                    onChange={handleFormChange}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((v) => !v)}
                    className="btn-action btn-neutral btn-w-sm btn-form"
                  >
                    {showCurrentPassword ? "숨김" : "보기"}
                  </button>
                </div>
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
                  disabled={saving}
                  className="btn-action btn-primary btn-w-md btn-header"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPage;
