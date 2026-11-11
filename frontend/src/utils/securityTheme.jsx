// 보안 점수 구간에 따라 안전, 주의, 위험 상태 및 테마 색상을 반환하는 유틸리티 파일
export const getSecurityTheme = (score) => {
  const numScore = Number(score) || 0;
  if (numScore >= 90) return { tone: "success", label: "안전" };
  if (numScore >= 50) return { tone: "warning", label: "주의" };
  return { tone: "danger", label: "위험" };
};
