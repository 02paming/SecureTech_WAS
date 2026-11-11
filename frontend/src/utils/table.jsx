// 표의 행 개수를 맞춰주기 위한 빈 줄 패딩 및 페이지 초기화 훅 파일

import { useState } from "react";

// 페이지를 넘겨도 표 높이가 같도록 빈 줄로 채운다
export const padRows = (arr, length) => {
  const padded = [...arr];
  while (padded.length < length) padded.push({ isEmpty: true });
  return padded;
};

// 검색·필터 값이 바뀌면 렌더링 중에 첫 페이지로 되돌린다
export const useResetPage = (values, reset) => {
  const [prev, setPrev] = useState(values);
  if (values.some((value, i) => value !== prev[i])) {
    setPrev(values);
    reset();
  }
};
