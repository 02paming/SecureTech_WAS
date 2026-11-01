// 정책 판단 종류별 색상. 화이트 의심과 블랙 의심은 점수 구간의 노랑, 주황과 맞춘다
export const POLICY_TONES = {
  "시스템 기본 허용": "success",
  "보호 허용": "success",
  "수동 허용": "success",
  "AI 안전": "success",
  "화이트 의심": "score-yellow",
  "블랙 의심": "score-orange",
  "수동 차단": "danger",
  "AI 위험": "danger",
};

export const STATUS_LABELS = {
  정상: "정상 통과",
  의심: "AI 의심 통과",
  차단: "차단",
};

// 처리 결과 색상. 의심은 지금 정책 종류를 따른다
export const getResultTone = (status, policy) => {
  if (status === "차단") return "danger";
  if (status === "의심") return POLICY_TONES[policy] || "warning";
  return "success";
};
