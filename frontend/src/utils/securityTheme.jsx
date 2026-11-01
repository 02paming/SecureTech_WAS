// 보안 점수 구간별 표시 규칙: 90점 이상 안전, 50점 이상 주의, 그 미만 위험
export const getSecurityTheme = (score) => {
  const numScore = Number(score) || 0;
  if (numScore >= 90) return { tone: "success", label: "안전" };
  if (numScore >= 50) return { tone: "warning", label: "주의" };
  return { tone: "danger", label: "위험" };
};
