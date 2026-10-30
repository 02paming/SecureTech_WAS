import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

const Signup = () => {
  const [formData, setFormData] = useState({
    member_id: "",
    password: "",
    name: "",
    email: "",
    phone_number: "",
    jumin_no: "",
    address: "",
  });

  const [duplicateErrors, setDuplicateErrors] = useState({});
  const [successMsgs, setSuccessMsgs] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const currentHost = window.location.hostname;
  const baseUrl =
    import.meta.env.VITE_API_BASE_URL ||
    (currentHost === "localhost" || currentHost.startsWith("192.168.")
      ? `http://${currentHost}:8000`
      : "https://api.securetechkg.digital");

  const validateRRN = (rrn) => {
    const cleanRRN = rrn.replace(/[^0-9]/g, "");
    if (cleanRRN.length !== 13) return false;
    const month = parseInt(cleanRRN.substring(2, 4), 10);
    const day = parseInt(cleanRRN.substring(4, 6), 10);
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    return true;
  };

  const handleChange = (e) => {
    let { name, value } = e.target;

    if (name === "phone_number") {
      value = value.replace(/[^0-9]/g, "");
      if (value.length > 3 && value.length <= 7) {
        value = value.replace(/(\d{3})(\d+)/, "$1-$2");
      } else if (value.length > 7) {
        value = value.replace(/(\d{3})(\d{4})(\d+)/, "$1-$2-$3");
      }

      if (value.length === 13) {
        setSuccessMsgs((prev) => ({
          ...prev,
          phone_number: "✓ 올바른 연락처입니다.",
        }));
        setDuplicateErrors((prev) => {
          const ne = { ...prev };
          delete ne.phone_number;
          return ne;
        });
      } else {
        setDuplicateErrors((prev) => ({
          ...prev,
          phone_number: "연락처 11자리를 모두 입력해주세요.",
        }));
        setSuccessMsgs((prev) => {
          const ns = { ...prev };
          delete ns.phone_number;
          return ns;
        });
      }
    }

    if (name === "jumin_no") {
      value = value.replace(/[^0-9]/g, "");
      if (value.length > 6) {
        value = value.replace(/(\d{6})(\d+)/, "$1-$2");
      }

      if (value.length === 14) {
        const isValid = validateRRN(value);
        if (isValid) {
          setSuccessMsgs((prev) => ({ ...prev, jumin_no: "✓ 사용 가능" }));
          setDuplicateErrors((prev) => {
            const ne = { ...prev };
            delete ne.jumin_no;
            return ne;
          });
        } else {
          setDuplicateErrors((prev) => ({
            ...prev,
            jumin_no: "잘못된 주민등록번호 형식입니다.",
          }));
          setSuccessMsgs((prev) => {
            const ns = { ...prev };
            delete ns.jumin_no;
            return ns;
          });
        }
      } else {
        setDuplicateErrors((prev) => ({
          ...prev,
          jumin_no: "주민등록번호 13자리를 모두 입력해주세요.",
        }));
        setSuccessMsgs((prev) => {
          const ns = { ...prev };
          delete ns.jumin_no;
          return ns;
        });
      }
    }

    if (name === "email") {
      if (value && !value.includes("@")) {
        setDuplicateErrors((prev) => ({
          ...prev,
          email: "올바른 이메일 형식이 아닙니다. (@ 포함)",
        }));
        setSuccessMsgs((prev) => {
          const ns = { ...prev };
          delete ns.email;
          return ns;
        });
      } else {
        setDuplicateErrors((prev) => {
          const ne = { ...prev };
          delete ne.email;
          return ne;
        });
        if (value) {
          setSuccessMsgs((prev) => ({ ...prev, email: "✓ 사용 가능" }));
        } else {
          setSuccessMsgs((prev) => {
            const ns = { ...prev };
            delete ns.email;
            return ns;
          });
        }
      }
    }

    if (name === "member_id") {
      setDuplicateErrors((prev) => {
        const ne = { ...prev };
        delete ne.member_id;
        return ne;
      });
      setSuccessMsgs((prev) => {
        const ns = { ...prev };
        delete ns.member_id;
        return ns;
      });
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckId = async () => {
    if (!formData.member_id.trim()) {
      alert("아이디를 입력해주세요.");
      return;
    }
    try {
      const res = await axios.post(`${baseUrl}/api/auth/check-duplicate/`, {
        field: "member_id",
        value: formData.member_id.trim(),
      });

      if (res.data && res.data.is_duplicate === false) {
        setSuccessMsgs((prev) => ({
          ...prev,
          member_id: "✓ 사용 가능한 아이디입니다.",
        }));
        setDuplicateErrors((prev) => {
          const ne = { ...prev };
          delete ne.member_id;
          return ne;
        });
      } else {
        const serverMsg = res.data?.message || "이미 사용 중인 아이디입니다.";
        setDuplicateErrors((prev) => ({ ...prev, member_id: serverMsg }));
        setSuccessMsgs((prev) => {
          const ns = { ...prev };
          delete ns.member_id;
          return ns;
        });
      }
    } catch (err) {
      const realErrorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "중복 확인 통신 실패";
      setDuplicateErrors((prev) => ({ ...prev, member_id: realErrorMsg }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Object.keys(duplicateErrors).length > 0) {
      alert(
        "중복되거나 올바르지 않은 항목이 있습니다. 입력 내용을 확인해주세요.",
      );
      return;
    }

    setLoading(true);
    try {
      // 💡 가입 신청 API 호출
      const res = await axios.post(`${baseUrl}/api/auth/signup/`, formData);
      if (res.data.status === "success") {
        alert("가입 신청이 완료되었습니다. 관리자 승인 후 로그인 가능합니다.");
        navigate("/user-login");
      }
    } catch (err) {
      alert(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "가입 신청 중 오류가 발생했습니다.",
      );
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
        minHeight: "90vh",
        padding: "20px",
      }}
    >
      <style>{`
        .form-row { display: flex; gap: 16px; }
        .form-col { flex: 1; }
        .id-input-group { display: flex; gap: 8px; }
        @media (max-width: 768px) {
          .form-row { flex-direction: column !important; gap: 18px !important; }
          .id-input-group { flex-direction: column !important; }
          .id-input-group button { width: 100% !important; padding: 14px !important; }
        }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: "550px",
          padding: "40px",
          backgroundColor: "#1e293b",
          borderRadius: "12px",
          border: "1px solid #334155",
          boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
          boxSizing: "border-box",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>🚀</div>
          <h2
            style={{
              fontSize: "22px",
              fontWeight: "bold",
              color: "#f8fafc",
              marginBottom: "6px",
            }}
          >
            SecureTech 가입 신청
          </h2>
          <p style={{ fontSize: "13px", color: "#94a3b8" }}>
            사내 인트라넷 및 보안망 접근을 위한 계정을 신청합니다.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "18px" }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: "#94a3b8",
                marginBottom: "6px",
              }}
            >
              가입 희망 아이디 <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <div className="id-input-group">
              <input
                type="text"
                name="member_id"
                value={formData.member_id}
                onChange={handleChange}
                required
                placeholder="아이디 입력"
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #475569",
                  backgroundColor: "#0f172a",
                  color: "#fff",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={handleCheckId}
                style={{
                  padding: "0 16px",
                  backgroundColor: "#334155",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  whiteSpace: "nowrap",
                }}
              >
                중복확인
              </button>
            </div>
            {successMsgs.member_id && (
              <div
                style={{ color: "#22c55e", fontSize: "12px", marginTop: "6px" }}
              >
                {successMsgs.member_id}
              </div>
            )}
            {duplicateErrors.member_id && (
              <div
                style={{ color: "#ef4444", fontSize: "12px", marginTop: "6px" }}
              >
                {duplicateErrors.member_id}
              </div>
            )}
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: "#94a3b8",
                marginBottom: "6px",
              }}
            >
              비밀번호 <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="비밀번호 입력"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #475569",
                backgroundColor: "#0f172a",
                color: "#fff",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>

          <div className="form-row">
            <div className="form-col">
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#94a3b8",
                  marginBottom: "6px",
                }}
              >
                이름 <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="이름 입력"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #475569",
                  backgroundColor: "#0f172a",
                  color: "#fff",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>
            <div className="form-col">
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#94a3b8",
                  marginBottom: "6px",
                }}
              >
                이메일 <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="이메일 입력 (@포함)"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #475569",
                  backgroundColor: "#0f172a",
                  color: "#fff",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
              {successMsgs.email && (
                <div
                  style={{
                    color: "#22c55e",
                    fontSize: "12px",
                    marginTop: "6px",
                  }}
                >
                  {successMsgs.email}
                </div>
              )}
              {duplicateErrors.email && (
                <div
                  style={{
                    color: "#ef4444",
                    fontSize: "12px",
                    marginTop: "6px",
                  }}
                >
                  {duplicateErrors.email}
                </div>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-col">
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#94a3b8",
                  marginBottom: "6px",
                }}
              >
                연락처 <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleChange}
                required
                placeholder="010-0000-0000"
                maxLength="13"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #475569",
                  backgroundColor: "#0f172a",
                  color: "#fff",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
              {successMsgs.phone_number && (
                <div
                  style={{
                    color: "#22c55e",
                    fontSize: "12px",
                    marginTop: "6px",
                  }}
                >
                  {successMsgs.phone_number}
                </div>
              )}
              {duplicateErrors.phone_number && (
                <div
                  style={{
                    color: "#ef4444",
                    fontSize: "12px",
                    marginTop: "6px",
                  }}
                >
                  {duplicateErrors.phone_number}
                </div>
              )}
            </div>
            <div className="form-col">
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#94a3b8",
                  marginBottom: "6px",
                }}
              >
                주민등록번호 <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                name="jumin_no"
                value={formData.jumin_no}
                onChange={handleChange}
                required
                placeholder="- 없이 13자리 숫자"
                maxLength="14"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #475569",
                  backgroundColor: "#0f172a",
                  color: "#fff",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
              {successMsgs.jumin_no && (
                <div
                  style={{
                    color: "#22c55e",
                    fontSize: "12px",
                    marginTop: "6px",
                  }}
                >
                  {successMsgs.jumin_no}
                </div>
              )}
              {duplicateErrors.jumin_no && (
                <div
                  style={{
                    color: "#ef4444",
                    fontSize: "12px",
                    marginTop: "6px",
                  }}
                >
                  {duplicateErrors.jumin_no}
                </div>
              )}
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: "#94a3b8",
                marginBottom: "6px",
              }}
            >
              거주지 주소 <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
              placeholder="실 거주지 주소 입력"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #475569",
                backgroundColor: "#0f172a",
                color: "#fff",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>

          <div
            style={{
              padding: "16px",
              backgroundColor: "#0f172a",
              borderRadius: "8px",
              border: "1px solid #1e293b",
              marginTop: "10px",
            }}
          >
            <p
              style={{
                color: "#38bdf8",
                fontSize: "13px",
                fontWeight: "bold",
                margin: "0 0 8px 0",
              }}
            >
              안내사항
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: "20px",
                color: "#94a3b8",
                fontSize: "12px",
                lineHeight: "1.5",
              }}
            >
              <li>
                가입 신청 후 관리자의 승인이 완료되어야 로그인이 가능합니다.
              </li>
              <li>정규 사원으로 승인될 경우 사번이 자동 부여됩니다.</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              fontSize: "15px",
              fontWeight: "600",
              backgroundColor: "#0284c7",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              marginTop: "10px",
            }}
          >
            {loading ? "신청 중..." : "가입 신청하기"}
          </button>
        </form>

        <div
          style={{ marginTop: "24px", textAlign: "center", fontSize: "13px" }}
        >
          <Link
            to="/user-login"
            style={{ color: "#38bdf8", textDecoration: "none" }}
          >
            ← 로그인 화면으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
