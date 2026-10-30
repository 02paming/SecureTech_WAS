import axios from "axios";

// 도메인 주소 정규화 (http, www, 포트, 경로 제거)
export const normalizeDomain = (url) => {
  if (!url) return "";
  let cleaned = String(url).trim().toLowerCase();
  cleaned = cleaned.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "");
  cleaned = cleaned.split("/")[0].split(":")[0];
  return cleaned;
};

// 도메인 실시간 차단 검사 및 위협 보고
export const checkAndInterceptDomain = async (inputUrl) => {
  const targetDomain = normalizeDomain(inputUrl);
  if (!targetDomain) return false;

  const currentHost = window.location.hostname;
  const rawBaseUrl =
    import.meta.env.VITE_API_BASE_URL || `http://${currentHost}:8000`;
  const baseUrl = rawBaseUrl.replace(/\/+$/, "");

  try {
    // 💡 차단 목록 조회 API 호출
    const res = await axios.get(`${baseUrl}/api/policies/blocklist/`);
    const policyList = Array.isArray(res.data) ? res.data : [];

    // 💡 엑셀 DB 필드명인 blacklist_domain 기준으로 완벽 대조
    const isBlocked = policyList.some((item) => {
      const blocked =
        typeof item === "string"
          ? item
          : item.blacklist_domain || item.no_access_domain;
      if (!blocked) return false;
      const normalizedBlocked = normalizeDomain(blocked);
      return (
        targetDomain === normalizedBlocked ||
        targetDomain.endsWith(`.${normalizedBlocked}`)
      );
    });

    if (isBlocked) {
      alert(
        `🚨 [사내 보안 차단 알림]\n\n'${targetDomain}' 주소는 사내 보안 정책에 의해 차단된 유해 사이트입니다.\n접근 시도가 보안 관제 대시보드에 즉시 보고되었습니다.`,
      );

      const savedUser = localStorage.getItem("user");
      let violatorId = "UNKNOWN";
      let clientIp = "127.0.0.1";

      if (savedUser) {
        try {
          const user = JSON.parse(savedUser);
          violatorId =
            user.employee_id || user.emp_id || user.name || "UNKNOWN";
          if (user.online_ip) clientIp = user.online_ip;
        } catch (e) {
          console.error("사용자 세션 파싱 오류:", e);
        }
      }

      // 💡 백엔드 위협 보고 API 호출 (views.py report_violation 연동)
      await axios
        .post(`${baseUrl}/api/policies/report-violation/`, {
          violator: violatorId,
          blocked_domain: targetDomain,
          source_ip: clientIp,
        })
        .catch(() => {});

      return true;
    }

    return false;
  } catch (err) {
    console.error("도메인 보안 정책 검사 오류:", err);
    return false;
  }
};
