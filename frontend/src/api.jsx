// Axios 기반의 API 통신 기본 설정, 동적 베이스 URL 판별 및 요청/응답 인터셉터를 관리하는 모듈 파일

import axios from "axios";

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, "");
  }
  try {
    const host = window.location.hostname;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.startsWith("192.168.") ||
      host.startsWith("100.")
    ) {
      return `http://${host}:8000`;
    }
    if (host.includes("securetechkg.digital")) {
      return "https://api.securetechkg.digital";
    }
  } catch {
    // 예외 발생 시 기본값
  }
  return `http://${window.location.hostname}:8000`;
};

export const API_BASE_URL = getBaseUrl();
// 관제 화면 자동 갱신 주기
export const MONITOR_REFRESH_MS = 30000;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
  withCredentials: true,
});

// 요청 인터셉터: 세션 저장소 양쪽 모두 확인하여 사용자 ID 자동 주입
api.interceptors.request.use(
  (config) => {
    const loggedInUser =
      sessionStorage.getItem("user") || localStorage.getItem("user");
    if (loggedInUser) {
      try {
        const user = JSON.parse(loggedInUser);
        const userId = user.employee_id || user.emp_id;
        if (userId) config.headers["X-User-Id"] = userId;
      } catch (e) {
        console.error("사용자 정보 파싱 실패:", e);
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// 응답 인터셉터: 에러 발생 시 앱이 죽지 않고 안전하게 처리
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.warn(
        `[API] ${error.config?.url} 요청 실패 (상태코드: ${error.response.status})`,
      );
    } else {
      console.warn("[API] 백엔드 서버와 통신할 수 없습니다.");
    }
    return Promise.reject(error);
  },
);

export default api;
