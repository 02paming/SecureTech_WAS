// 날짜 객체를 받아 시, 분, 초를 두 자리 숫자로 패딩하여 포맷팅하는 유틸리티 파일
const pad2 = (n) => String(n).padStart(2, "0");

export const formatTimeKR = (date = new Date()) =>
  `${pad2(date.getHours())}시 ${pad2(date.getMinutes())}분 ${pad2(date.getSeconds())}초`;
