import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // 💡 1. 콘솔 로그 및 디버거 자동 제거 (메모리 누수 방지 및 속도 향상)
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        // 💡 2. 벤더(Vendor) 청크 분할 전략: 무거운 라이브러리들을 쪼개서 병렬 로딩
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) {
              return "react-core"; // 리액트 코어 묶음
            }
            if (id.includes("axios")) {
              return "axios"; // API 통신 모듈 묶음
            }
            // 나머지(그래프, QR)는 해당 화면을 열 때만 받도록 따로 묶지 않음
          }
        },
      },
    },
  },
});
