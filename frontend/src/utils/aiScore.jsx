// AI 위협 점수가 유효한 값인지 판별하는 유틸리티 함수 파일
export const hasAiScore = (score) => score !== null && score !== undefined && score >= 0;
