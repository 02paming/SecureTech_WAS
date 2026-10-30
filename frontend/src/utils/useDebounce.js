import { useState, useEffect } from "react";

// 사용자가 입력을 멈출 때까지 기다렸다가 마지막 값만 반환하는 최적화 훅
export default function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // delay(밀리초) 이후에 상태를 업데이트
    const timer = setTimeout(() => setDebouncedValue(value), delay);

    // 연속으로 타이핑하면 이전 타이머를 취소하여 렌더링을 방어
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
