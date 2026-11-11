// 사원 및 관리자 로그인, 구글 OTP 인증 UI 컴포넌트

import axios from "axios";
import { useState } from "react";
import QRCode from "react-qr-code";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../../api";
import { appAlert } from "../../utils/appDialog";

const Login = ({ setUser, isAdminMode = false }) => {
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [otpMode, setOtpMode] = useState(false);
  const [otpSetupMode, setOtpSetupMode] = useState(false);
  const [otpSecret, setOtpSecret] = useState("");
  const [otpUri, setOtpUri] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [tempEmpId, setTempEmpId] = useState("");
  const [otpTicket, setOtpTicket] = useState("");
  const baseUrl = API_BASE_URL;

  const processLoginSuccess = async (rawUser) => {
    if (isAdminMode && !rawUser.is_manager) {
      await appAlert(
        "관리자 권한이 없는 일반 계정입니다.\n사원 로그인 화면을 이용해 주세요.",
      );
      setLoading(false);
      return;
    }

    const userData = {
      ...rawUser,
      employee_id: rawUser.employee_id || rawUser.emp_id,
      emp_id: rawUser.emp_id || rawUser.employee_id,
    };

    localStorage.removeItem("user");
    sessionStorage.setItem("user", JSON.stringify(userData));
    if (rawUser.session_token) {
      sessionStorage.setItem("sessionToken", rawUser.session_token);
    }

    if (isAdminMode) {
      sessionStorage.setItem("adminPortalMode", "true");
    } else {
      sessionStorage.removeItem("adminPortalMode");
    }

    if (setUser) setUser(userData);

    if (isAdminMode) {
      window.location.href = "/dashboard";
    } else {
      window.location.href = "/";
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!empId.trim() || !password) {
      await appAlert(
        isAdminMode
          ? "관리자 아이디와 비밀번호를 모두 입력해 주세요."
          : "아이디와 비밀번호를 모두 입력해 주세요.",
      );
      return;
    }
    setLoading(true);

    try {
      const response = await axios.post(`${baseUrl}/api/auth/login/`, {
        employee_id: empId.trim(),
        password: password,
        is_admin_login: isAdminMode, // 백엔드에 관리자 창 여부를 전달하여 차단/허용 판단 보조
      });

      if (response.data.status === "otp_required") {
        setTempEmpId(response.data.employee_id);
        setOtpTicket(response.data.otp_ticket);
        setOtpMode(true);
        setOtpSetupMode(false);
        setLoading(false);
      } else if (response.data.status === "otp_setup_required") {
        setTempEmpId(response.data.employee_id);
        setOtpTicket(response.data.otp_ticket);
        setOtpSecret(response.data.otp_secret);
        setOtpUri(response.data.otp_uri);
        setOtpMode(true);
        setOtpSetupMode(true);
        setLoading(false);
      } else if (response.data.status === "success") {
        // 일반 사원이 로그인 창에서 로그인했을 때 즉시 실행됨
        await processLoginSuccess(response.data.user);
      }
    } catch (error) {
      await appAlert(
        error.response?.data?.message ||
        "아이디 또는 비밀번호가 올바르지 않습니다.",
      );
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      await appAlert("6자리 구글 OTP 인증 번호를 정확히 입력해 주세요.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${baseUrl}/api/auth/verify-otp/`, {
        employee_id: tempEmpId,
        otp_code: otpCode.trim(),
        otp_ticket: otpTicket,
      });

      if (response.data.status === "success") {
        await processLoginSuccess(response.data.user);
      }
    } catch (error) {
      await appAlert(
        error.response?.data?.message ||
        "인증 번호가 일치하지 않거나 만료되었습니다.",
      );
      setOtpCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`auth-wrapper is-full ${isAdminMode ? "auth-admin" : ""}`}>
      <div className="card auth-card">
        {otpMode ? (
          <>
            <div className="auth-header">
              <h2 className="auth-title text-primary">2단계 보안 인증</h2>
              <p className="auth-subtitle">
                Google OTP 앱의 6자리 코드를 입력하세요.
              </p>
            </div>

            {otpSetupMode && (
              <div className="notice-box tone-danger is-center">
                <strong className="notice-title text-danger">
                  구글 OTP 최초 설정
                </strong>

                {otpUri && (
                  <div className="qr-frame">
                    <QRCode value={otpUri} size={100} />
                  </div>
                )}

                <p className="notice-text">
                  앱 하단 <strong>[+]</strong> 버튼 →{" "}
                  <strong>[QR 코드 스캔]</strong>
                </p>
                <p className="notice-text">카메라 불가 시 아래 설정 키 입력</p>
                <div className="otp-secret">{otpSecret}</div>
              </div>
            )}

            <form
              onSubmit={handleOtpSubmit}
              autoComplete="off"
              className="auth-form"
            >
              <input
                type="text"
                name="secure_otp_code"
                autoComplete="off"
                maxLength="6"
                placeholder="예: 123456"
                value={otpCode}
                onChange={(e) =>
                  setOtpCode(e.target.value.replace(/[^0-9]/g, ""))
                }
                required
                autoFocus
                className="custom-input otp-input"
              />

              <button
                type="submit"
                className="btn-action btn-primary btn-block"
                disabled={loading}
              >
                {loading ? "인증 중..." : "인증하고 로그인"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setOtpMode(false);
                  setOtpCode("");
                }}
                className="btn-action btn-neutral btn-block"
                disabled={loading}
              >
                취소하고 뒤로 가기
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="auth-header">
              <h2 className="auth-title text-primary">
                {isAdminMode
                  ? "관리자 로그인"
                  : "SecureTech 사원 로그인"}
              </h2>
              <p className="auth-subtitle">
                {isAdminMode
                  ? "인가된 보안 관리자 전용 인증 화면입니다."
                  : "아이디와 비밀번호를 입력해 로그인해 주세요."}
              </p>
            </div>

            <form
              onSubmit={handleLogin}
              autoComplete="off"
              className="auth-form"
            >
              <div className="form-group">
                <label className="form-label">
                  {isAdminMode ? "관리자 아이디" : "아이디"}
                </label>
                <input
                  type="text"
                  name="no_autofill_username"
                  autoComplete="off"
                  placeholder={
                    isAdminMode ? "관리자 아이디 입력" : "아이디 입력"
                  }
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  required
                  autoFocus
                  className="custom-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">비밀번호</label>
                <input
                  type="password"
                  name="no_autofill_password"
                  autoComplete="new-password"
                  placeholder="비밀번호 입력"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="custom-input"
                />
              </div>

              <button
                type="submit"
                className="btn-action btn-primary btn-block"
                disabled={loading}
              >
                {loading
                  ? isAdminMode
                    ? "관리자 인증 확인 중..."
                    : "로그인 중..."
                  : isAdminMode
                    ? "관리자 로그인"
                    : "로그인"}
              </button>
            </form>

            {isAdminMode ? (
              <div className="auth-footer text-danger">
                ※ 주의: 비인가자의 접근 시도는 실시간 기록 및 차단됩니다.
              </div>
            ) : (
              <div className="auth-footer auth-links">
                <Link to="/" className="text-link">
                  ← 홈으로
                </Link>
                <Link to="/signup" className="text-link is-primary">
                  가입 신청
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
