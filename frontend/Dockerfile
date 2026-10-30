# ----- [1단계: 빌드 환경] -----
# 1. Node.js 환경을 가져와서 'build-stage'라고 부름 (docker.io 명시하여 선택창 생략)
FROM docker.io/library/node:20-alpine as build-stage

# 2. 작업할 폴더 지정
WORKDIR /app

# 3. 패키지 파일만 먼저 복사해서 설치 (캐시 최적화)
COPY package*.json ./
RUN npm install

# 4. 나머지 소스 코드 전부 복사 후 빌드 (이때 컨테이너 안에서 dist가 생성됨)
COPY . .
RUN npm run build

# ----- [2단계: 실행 환경 (보안 및 경량화)] -----
# 5. 가볍고 빠른 Nginx 웹 서버 환경 가져오기 (docker.io 명시)
FROM docker.io/library/nginx:alpine

# 6. 우리가 만든 Nginx 설정 파일 덮어쓰기
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# 7. 1단계(build-stage)에서 만들어진 dist 폴더의 결과물만 Nginx 서빙 폴더로 쏙 빼오기
COPY --from=build-stage /app/dist /usr/share/nginx/html

# 8. 80 포트 개방 및 Nginx 실행
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]