// AI 위협 점수 표시 규칙: 30점 이하 녹색, 50점 이하 노랑, 70점 이하 주황, 그 초과 빨강
// 엔진의 점수 구간이 바뀌면 이 값만 고친다. 음수나 빈 값은 점수 없음이다.
export const hasAiScore = (score) => score !== null && score !== undefined && score >= 0;

export const getAiScoreClass = (score) => {
  if (!hasAiScore(score)) return "text-muted";
  if (score <= 30) return "text-success";
  if (score <= 50) return "text-score-yellow";
  if (score <= 70) return "text-score-orange";
  return "text-danger";
};
