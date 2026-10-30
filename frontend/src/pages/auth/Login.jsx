import axios from "axios";
import { useState } from "react";
import QRCode from "react-qr-code";
import { Link, useNavigate } from "react-router-dom";

const Login = ({ setUser, isAdminMode = false }) => {
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [otpMode, setOtpMode] = useState(false);
  const [otpSetupMode, setOtpSetupMode] = useState(false);
  const [otpSecret, setOtpSecret] = useState("");
  const [otpUri, setOtpUri] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [tempEmpId, setTempEmpId] = useState("");

  const currentHost = window.location.hostname;
  const baseUrl =
    import.meta.env.VITE_API_BASE_URL ||
    (currentHost === "localhost" || currentHost.startsWith("192.168.")
      ? `http://${currentHost}:8000`
      : "https://api.securetechkg.digital");

  const processLoginSuccess = (rawUser) => {
    if (isAdminMode && !rawUser.is_manager) {
      alert(
        "관리자 권한이 없는 일반 계정입니다.\n사원 전용 로그인 창을 이용해 주세요.",
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
      alert(
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
        is_admin_login: isAdminMode, // 💡 백엔드에 관리자 창 여부를 전달하여 차단/허용 판단 보조
      });

      if (response.data.status === "otp_required") {
        setTempEmpId(response.data.employee_id);
        setOtpMode(true);
        setOtpSetupMode(false);
        setLoading(false);
      } else if (response.data.status === "otp_setup_required") {
        setTempEmpId(response.data.employee_id);
        setOtpSecret(response.data.otp_secret);
        setOtpUri(response.data.otp_uri);
        setOtpMode(true);
        setOtpSetupMode(true);
        setLoading(false);
      } else if (response.data.status === "success") {
        // 일반 사원이 로그인 창에서 로그인했을 때 즉시 실행됨
        processLoginSuccess(response.data.user);
      }
    } catch (error) {
      alert(
        error.response?.data?.message ||
          "아이디 또는 비밀번호가 올바르지 않습니다.",
      );
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      alert("6자리 구글 OTP 인증 번호를 정확히 입력해 주세요.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${baseUrl}/api/auth/verify-otp/`, {
        employee_id: tempEmpId,
        otp_code: otpCode.trim(),
      });

      if (response.data.status === "success") {
        processLoginSuccess(response.data.user);
      }
    } catch (error) {
      alert(
        error.response?.data?.message ||
          "인증 번호가 일치하지 않거나 만료되었습니다.",
      );
      setOtpCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#f8fafc",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "360px",
          padding: "20px 24px",
          backgroundColor: "#ffffff",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        }}
      >
        {otpMode ? (
          <>
            <div style={{ textAlign: "center", marginBottom: "12px" }}>
              <div style={{ fontSize: "28px", marginBottom: "4px" }}>🔐</div>
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  color: isAdminMode ? "#851216" : "#0284c7",
                  margin: "0 0 4px 0",
                }}
              >
                2단계 보안 인증
              </h2>
              <p style={{ fontSize: "11px", color: "#64748b", margin: 0 }}>
                Google OTP 앱의 6자리 코드를 입력하세요.
              </p>
            </div>

            {otpSetupMode && (
              <div
                style={{
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fca5a5",
                  borderRadius: "8px",
                  padding: "10px",
                  marginBottom: "12px",
                  textAlign: "center",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    color: "#991b1b",
                    fontSize: "12px",
                    marginBottom: "8px",
                  }}
                >
                  ※ 구글 OTP 최초 설정 ※
                </strong>

                {otpUri && (
                  <div
                    style={{
                      display: "inline-block",
                      padding: "4px",
                      backgroundColor: "#fff",
                      border: "1px solid #f87171",
                      borderRadius: "6px",
                      marginBottom: "6px",
                    }}
                  >
                    <QRCode value={otpUri} size={100} />
                  </div>
                )}

                <p
                  style={{
                    margin: "0 0 6px 0",
                    fontSize: "10.5px",
                    color: "#7f1d1d",
                    lineHeight: "1.3",
                  }}
                >
                  앱 하단 <strong>[+]</strong> 버튼 ➔{" "}
                  <strong>[QR 코드 스캔]</strong>
                </p>

                <hr
                  style={{
                    borderTop: "1px dashed #fca5a5",
                    borderBottom: "none",
                    margin: "6px 0",
                  }}
                />

                <div style={{ fontSize: "11px", color: "#b91c1c" }}>
                  카메라 불가 시 아래 설정 키 입력
                  <br />
                  <div
                    style={{
                      marginTop: "6px",
                      fontSize: "10px",
                      letterSpacing: "0.5px",
                      backgroundColor: "#fee2e2",
                      padding: "8px",
                      borderRadius: "6px",
                      fontWeight: "bold",
                      wordBreak: "break-all",
                    }}
                  >
                    {otpSecret}
                  </div>
                </div>
              </div>
            )}

            <form
              onSubmit={handleOtpSubmit}
              autoComplete="off"
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              <div>
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
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#f8fafc",
                    color: "#334155",
                    fontSize: "15px",
                    letterSpacing: "3px",
                    textAlign: "center",
                    boxSizing: "border-box",
                    outline: "none",
                    fontWeight: "bold",
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: "13px",
                  fontWeight: "600",
                  backgroundColor: isAdminMode ? "#851216" : "#0284c7",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
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
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: "12px",
                  fontWeight: "600",
                  backgroundColor: "transparent",
                  color: "#64748b",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
                disabled={loading}
              >
                취소하고 뒤로 가기
              </button>
            </form>
          </>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>🛡️</div>
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  color: isAdminMode ? "#851216" : "#0f172a",
                  margin: "0 0 6px 0",
                }}
              >
                {isAdminMode
                  ? "보안 관제 콘솔 로그인"
                  : "SecureTech 사원 로그인"}
              </h2>
              <p style={{ fontSize: "11px", color: "#64748b", margin: 0 }}>
                {isAdminMode
                  ? "인가된 보안 관리자 전용 인증 화면입니다."
                  : "아이디와 비밀번호를 입력해 로그인해 주세요."}
              </p>
            </div>

            <form
              onSubmit={handleLogin}
              autoComplete="off"
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#334155",
                    marginBottom: "4px",
                  }}
                >
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
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: isAdminMode ? "#f1f5f9" : "#ffffff",
                    color: "#334155",
                    fontSize: "13px",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#334155",
                    marginBottom: "4px",
                  }}
                >
                  비밀번호
                </label>
                <input
                  type="password"
                  name="no_autofill_password"
                  autoComplete="new-password"
                  placeholder="비밀번호 입력"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: isAdminMode ? "#f1f5f9" : "#ffffff",
                    color: "#334155",
                    fontSize: "13px",
                    boxSizing: "border-box",
                    outline: "none",
                    letterSpacing: isAdminMode ? "2px" : "normal",
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "13px",
                  fontWeight: "600",
                  backgroundColor: isAdminMode ? "#851216" : "#0284c7",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  marginTop: "4px",
                }}
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
              <div
                style={{
                  marginTop: "16px",
                  textAlign: "center",
                  fontSize: "11px",
                  color: "#ef4444",
                  fontWeight: "500",
                }}
              >
                ※ 주의: 비인가자의 접근 시도는 실시간 기록 및 차단됩니다.
              </div>
            ) : (
              <div
                style={{
                  marginTop: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "11px",
                }}
              >
                <Link
                  to="/"
                  style={{
                    color: "#64748b",
                    textDecoration: "none",
                    fontWeight: "500",
                  }}
                >
                  ← 홈으로
                </Link>
                <Link
                  to="/signup"
                  style={{
                    color: "#0284c7",
                    textDecoration: "none",
                    fontWeight: "600",
                  }}
                >
                  신규 사원 계정 신청
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
