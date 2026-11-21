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

// 표 하나가 독립적으로 쓰는 page/페이지당 건수 상태를 묶어서 제공한다.
// 건수를 바꾸면 항상 1페이지로 되돌아간다.
export const usePagination = (initialPerPage = 10) => {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(initialPerPage);
  const changePerPage = (n) => {
    setPerPage(n);
    setPage(1);
  };
  return { page, setPage, perPage, setPerPage, changePerPage };
};
