// AI 위협 점수 표시 규칙. 음수나 빈 값은 점수 없음이다.
// 색상은 기준 변경에 흔들리지 않도록 숫자가 아니라 정책 판단(policyTone)을 따른다.
export const hasAiScore = (score) => score !== null && score !== undefined && score >= 0;
