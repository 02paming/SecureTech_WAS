// 신규 사원이 사내망 접속 계정을 생성하기 위해 가입 신청 정보를 입력하고 검증하는 회원가입 UI 컴포넌트

import axios from "axios";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../api";
import { appAlert } from "../../utils/appDialog";

const DAUM_POSTCODE_SRC = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;

const FieldMessage = ({ success, error }) => (
  <>
    {success && <div className="form-message text-success">{success}</div>}
    {error && <div className="form-message text-danger">{error}</div>}
  </>
);

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
  const [showPassword, setShowPassword] = useState(false);
  const [showJumin, setShowJumin] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const navigate = useNavigate();
  const baseUrl = API_BASE_URL;

  useEffect(() => {
    if (window.daum?.Postcode || document.querySelector(`script[src="${DAUM_POSTCODE_SRC}"]`)) return;
    const script = document.createElement("script");
    script.src = DAUM_POSTCODE_SRC;
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const handleSearchAddress = () => {
    if (!window.daum?.Postcode) {
      appAlert("주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        const picked = data.roadAddress || data.jibunAddress || data.address;
        setFormData((prev) => ({ ...prev, address: picked }));
      },
    }).open();
  };

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
      if (value && !EMAIL_PATTERN.test(value)) {
        setDuplicateErrors((prev) => ({
          ...prev,
          email: "올바른 이메일 형식이 아닙니다. (예: user@example.com)",
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
      setSuccessMsgs((prev) => {
        const ns = { ...prev };
        delete ns.member_id;
        return ns;
      });
      if (value && value.trim().length < 6) {
        setDuplicateErrors((prev) => ({
          ...prev,
          member_id: "아이디는 6자 이상 입력해주세요.",
        }));
      } else {
        setDuplicateErrors((prev) => {
          const ne = { ...prev };
          delete ne.member_id;
          return ne;
        });
      }
    }

    if (name === "password") {
      if (value && !PASSWORD_PATTERN.test(value)) {
        setDuplicateErrors((prev) => ({
          ...prev,
          password: "영문, 숫자, 특수문자를 포함해 8자 이상 입력해주세요.",
        }));
        setSuccessMsgs((prev) => {
          const ns = { ...prev };
          delete ns.password;
          return ns;
        });
      } else {
        setDuplicateErrors((prev) => {
          const ne = { ...prev };
          delete ne.password;
          return ne;
        });
        if (value) {
          setSuccessMsgs((prev) => ({ ...prev, password: "✓ 사용 가능한 비밀번호입니다." }));
        } else {
          setSuccessMsgs((prev) => {
            const ns = { ...prev };
            delete ns.password;
            return ns;
          });
        }
      }
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckId = async () => {
    if (!formData.member_id.trim()) {
      await appAlert("아이디를 입력해주세요.");
      return;
    }
    if (formData.member_id.trim().length < 6) {
      await appAlert("아이디는 6자 이상 입력해주세요.");
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
    if (formData.member_id.trim().length < 6) {
      await appAlert("아이디는 6자 이상 입력해주세요.");
      return;
    }
    if (!PASSWORD_PATTERN.test(formData.password)) {
      await appAlert("비밀번호는 영문, 숫자, 특수문자를 포함해 8자 이상이어야 합니다.");
      return;
    }
    if (!EMAIL_PATTERN.test(formData.email)) {
      await appAlert("올바른 이메일 형식이 아닙니다. (예: user@example.com)");
      return;
    }
    if (Object.keys(duplicateErrors).length > 0) {
      await appAlert(
        "중복되거나 올바르지 않은 항목이 있습니다. 입력 내용을 확인해주세요.",
      );
      return;
    }

    setLoading(true);
    try {
      // 가입 신청 API 호출
      const res = await axios.post(`${baseUrl}/api/auth/signup/`, formData);
      if (res.data.status === "success") {
        await appAlert("가입 신청이 완료되었습니다. 관리자 승인 후 로그인 가능합니다.");
        navigate("/user-login");
      }
    } catch (err) {
      await appAlert(
        err.response?.data?.message ||
        err.response?.data?.error ||
        "가입 신청 중 오류가 발생했습니다.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="card auth-card auth-card-wide">
        <div className="auth-header">
          <h2 className="auth-title">SecureTech 가입 신청</h2>
          <p className="auth-subtitle">
            사내망 접속에 사용할 계정을 신청합니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">
              아이디 <span className="text-danger">*</span>
            </label>
            <div className="input-with-btn">
              <input
                type="text"
                name="member_id"
                value={formData.member_id}
                onChange={handleChange}
                required
                placeholder="6자 이상 입력"
                className="custom-input"
              />
              <button
                type="button"
                onClick={handleCheckId}
                className="btn-action btn-neutral btn-w-md btn-form"
              >
                중복 확인
              </button>
            </div>
            <FieldMessage success={successMsgs.member_id} error={duplicateErrors.member_id} />
          </div>

          <div className="form-group">
            <label className="form-label">
              비밀번호 <span className="text-danger">*</span>
            </label>
            <div className="input-with-btn">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="영문, 숫자, 특수문자 포함 8자 이상"
                className="custom-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="btn-action btn-neutral btn-w-sm btn-form"
              >
                {showPassword ? "숨김" : "보기"}
              </button>
            </div>
            <FieldMessage success={successMsgs.password} error={duplicateErrors.password} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                이름 <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="이름 입력"
                className="custom-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                이메일 <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="이메일 입력 (@포함)"
                className="custom-input"
              />
              <FieldMessage success={successMsgs.email} error={duplicateErrors.email} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                연락처 <span className="text-danger">*</span>
              </label>
              <div className="input-with-btn">
                <input
                  type={showPhone ? "text" : "password"}
                  autoComplete="off"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  required
                  placeholder="010-0000-0000"
                  maxLength="13"
                  className="custom-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPhone((v) => !v)}
                  className="btn-action btn-neutral btn-w-sm btn-form"
                >
                  {showPhone ? "숨김" : "보기"}
                </button>
              </div>
              <FieldMessage success={successMsgs.phone_number} error={duplicateErrors.phone_number} />
            </div>
            <div className="form-group">
              <label className="form-label">
                주민등록번호 <span className="text-danger">*</span>
              </label>
              <div className="input-with-btn">
                <input
                  type={showJumin ? "text" : "password"}
                  autoComplete="off"
                  name="jumin_no"
                  value={formData.jumin_no}
                  onChange={handleChange}
                  required
                  placeholder="- 없이 13자리 숫자"
                  maxLength="14"
                  className="custom-input"
                />
                <button
                  type="button"
                  onClick={() => setShowJumin((v) => !v)}
                  className="btn-action btn-neutral btn-w-sm btn-form"
                >
                  {showJumin ? "숨김" : "보기"}
                </button>
              </div>
              <FieldMessage success={successMsgs.jumin_no} error={duplicateErrors.jumin_no} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              주소 <span className="text-danger">*</span>
            </label>
            <div className="input-with-btn">
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                placeholder="주소 검색 버튼으로 입력하거나 직접 입력"
                className="custom-input"
              />
              <button
                type="button"
                onClick={handleSearchAddress}
                className="btn-action btn-neutral btn-w-md btn-form"
              >
                주소 검색
              </button>
            </div>
          </div>

          <div className="notice-box tone-primary">
            <strong className="notice-title text-primary">안내사항</strong>
            <ul className="notice-list">
              <li>
                가입 신청 후 관리자의 승인이 완료되어야 로그인이 가능합니다.
              </li>
              <li>사원으로 승인되면 사번이 자동 부여됩니다.</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-action btn-primary btn-block"
          >
            {loading ? "신청 중..." : "가입 신청"}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/user-login" className="text-link is-primary">
            ← 로그인으로
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
