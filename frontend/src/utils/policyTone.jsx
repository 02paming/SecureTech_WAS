// 정책 판단 종류 및 처리 결과에 따른 색상 톤과 상태 레이블을 정의한 유틸리티 파일
export const POLICY_TONES = {
  "시스템 기본 허용": "success",
  "보호 허용": "success",
  "수동 허용": "success",
  "AI 안전": "success",
  "화이트 의심": "score-yellow",
  "블랙 의심": "score-orange",
  "수동 차단": "danger",
  "AI 위험": "danger",
  "AI 차단": "danger",
  "MAC 스푸핑": "danger",
};

export const STATUS_LABELS = {
  정상: "정상 통과",
  의심: "AI 의심",
  차단: "차단",
};

// 처리 결과 색상. 의심은 지금 정책 종류를 따른다
export const getResultTone = (status, policy) => {
  if (status === "차단") return "danger";
  if (status === "의심") return POLICY_TONES[policy] || "warning";
  return "success";
};
