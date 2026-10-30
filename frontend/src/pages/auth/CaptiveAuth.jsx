import { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

const CaptiveAuth = () => {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [userName, setUserName] = useState("");

  // 백엔드 API 기본 주소 설정
  const baseUrl = (
    import.meta.env.VITE_API_BASE_URL ||
    `http://${window.location.hostname}:8000`
  ).replace(/\/+$/, "");

  // 사내망 캡티브 포털 인증 요청
  const handleAuth = async (e) => {
    e.preventDefault();
    if (!employeeId.trim() || !password) {
      alert("사번과 비밀번호를 모두 입력해 주세요.");
      return;
    }

    setLoading(true);
    try {
      // 💡 백엔드 captive_login API 호출 (views.py captive_login과 연동)
      const res = await axios.post(`${baseUrl}/api/auth/captive-login/`, {
        employee_id: employeeId.trim(),
        password: password,
      });

      if (res.data.status === "success") {
        const user = res.data.user || {};
        const displayName = user.name || "사원";
        setUserName(displayName);
        setIsSuccess(true);

        // 로그인 사용자 로컬 스토리지 보관
        const userData = {
          ...user,
          employee_id: user.emp_id || user.employee_id || employeeId.trim(),
          emp_id: user.emp_id || user.employee_id || employeeId.trim(),
        };
        localStorage.setItem("user", JSON.stringify(userData));

        alert(
          `[인증 성공]\n${displayName} 사원님 인증이 완료되었습니다.\n외부 인터넷 통신이 인가되었습니다.`,
        );
      }
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "인증에 실패했습니다. 사번 및 비밀번호를 확인해주세요.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="card auth-card captive-card">
        <div className="auth-header">
          <div className="auth-icon">🛡️</div>
          <h2 className="auth-title">사내 네트워크 접근 인증 (NAC)</h2>
          <p className="auth-subtitle">
            외부 인터넷 연결을 위해 <strong>사원 인증</strong>이 필요합니다.
            <br />
            부여받은 사번(아이디)과 비밀번호를 입력해주세요.
          </p>
        </div>

        {isSuccess ? (
          <div className="captive-success-box">
            <div className="captive-success-icon">✓</div>
            <h3 className="captive-success-title">인증 승인 완료</h3>
            <p className="captive-success-desc">
              <strong>{userName}</strong> 사원님의 단말이 외부 인터넷 접속 승인
              목록에 등록되었습니다.
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                marginTop: "16px",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  (window.location.href = "https://www.google.com")
                }
                className="btn-success-action"
              >
                인터넷 이용 시작하기
              </button>
              <Link
                to="/"
                className="btn-action"
                style={{
                  textAlign: "center",
                  padding: "10px",
                  textDecoration: "none",
                  backgroundColor: "#f1f5f9",
                }}
              >
                사내 포털 메인으로 이동
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAuth} className="auth-form">
            <div className="form-group">
              <label className="form-label">사원 아이디 / 사번</label>
              <input
                type="text"
                className="custom-input"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="예: developer01 또는 사원 아이디"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">비밀번호</label>
              <input
                type="password"
                className="custom-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary auth-submit-btn"
            >
              {loading
                ? "인증 확인 중..."
                : "사내망 인증 및 외부 인터넷 접속 승인"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default CaptiveAuth;
