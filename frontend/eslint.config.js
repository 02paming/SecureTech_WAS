// ESLint 린트 설정 파일로, React 훅 및 Vite 환경에 맞춘 코드 검사 규칙을 지정

import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // 화면이 열릴 때 데이터를 불러오는 일반적인 방식까지 오류로 잡아 끈다
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);
