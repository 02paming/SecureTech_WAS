#  SecureTech WAS — 관리자 웹 · 백엔드

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Django](https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![MariaDB](https://img.shields.io/badge/MariaDB-003545?style=for-the-badge&logo=mariadb&logoColor=white)

> **L3 스위치 포트 미러링으로 사내망 트래픽 사본을 분석하고, Raw Socket 으로 TCP RST·HTTP 302 를 주입해 차단하는 Out-of-Path 사내망 접근 통제 시스템** — 그중 **관리자 웹(React)·관리 API(Django)·엔진 동기화 백엔드(8080)** 를 담은 저장소입니다.

- 4인 팀 프로젝트 · 2026.10.01 ~ 2026.11.20
- 패킷 제어 엔진(C)·AI 판정 서버·캡티브 포털 프록시는 [Captive](https://github.com/02paming/Captive) 저장소에 있습니다.

🔗 **[![Notion](https://img.shields.io/badge/Notion_개발_일지_보러가기-000000?style=for-the-badge&logo=notion&logoColor=white)](https://app.notion.com/p/206597615cf6415c8859374a152ad97c)**

---

## 1. 시스템 구성

![시스템 아키텍처 구조도](https://github.com/user-attachments/assets/c6ea5da3-6f75-47ee-99a5-a29eb2e91e31)

| 구성 요소 | 포트 | 역할 | 저장소 |
|---|---|---|---|
| 관리자 웹 (`frontend/`, React + Vite) | 5173 | 사원·정책·로그·대시보드·AI 임계치/모델 관리 화면 | 이 저장소 |
| 관리 API (`api/`, Django + DRF, Gunicorn 4 workers) | 8000 | 관리자 인증·사원 관리·정책 변경·로그 조회·대시보드 집계 | 이 저장소 |
| 엔진 동기화 백엔드 (`pcap_checker.py`) | 8080 | 사원 인증 검증, 접속·차단 로그 저장, 정책·도메인·AI 설정을 엔진 쪽 프록시로 전달 | 이 저장소 |
| MAC 불일치 알림 (`manage.py watch_mac_alerts`) | — | IP 스푸핑 의심 로그 감시·알림 | 이 저장소 |
| 패킷 제어 엔진 · AI 판정 서버 · 캡티브 포털 프록시 | 5000 등 | 트래픽 분석·차단, 악성 도메인 판정 | [Captive](https://github.com/02paming/Captive) |
| MariaDB | 3306 | `internal_db` | DB망 |

망은 클라이언트망(192.168.2.x)·분석망(192.168.3.x)·DB망(192.168.4.x)으로 **서브넷을 분리**했습니다. 엔진 쪽은 DB 를 직접 다루지 않고, **DB 접근은 이 저장소의 백엔드에만** 있습니다.

## 2. 주요 기능

- **사원 인증**: 캡티브 포털에서 받은 사번·IP·MAC 을 `/api/verify`(8080)로 검증 → 엔진에 인증 반영
- **정책 관리**: 근무시간·미활동 만료 시간, 블랙·화이트리스트 도메인을 관리자 웹에서 바꾸면 엔진까지 재시작 없이 전달
- **AI 관리**: 판정 임계치(차단/의심 구간) 조정, 모델 버전 교체, 모델 성능 지표 저장·조회
- **로그·대시보드**: 웹 접속·차단·MAC 불일치 로그 조회와 집계
- **관리자 보안**: OTP, 관리자 접속 허용 IP, 민감 정보(주민등록번호·OTP 비밀값) 암호화 저장

## 3. 실행

요구 사항: Python 3.10+, Node.js(프론트 빌드), MariaDB, PM2

```bash
cp .env.example .env          # 값 채우기 (DB 비밀번호·암호화 키 등, Git 에 올리지 않음)
python -m venv venv && venv/bin/pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..
pm2 start ecosystem.config.js # 8000(Gunicorn)·MAC 알림·5173(프론트)
venv/bin/python pcap_checker.py   # 8080 엔진 동기화 백엔드
```

| 환경변수 (`.env`) | 설명 |
|---|---|
| `DJANGO_SECRET_KEY`, `DB_PASSWORD` | Django·DB |
| `PCAP_BACKEND_URL` | 8080 백엔드 주소 (관리 API → 엔진 쪽 전달 경로) |
| `ADMIN_ALLOWED_IPS` | 관리자 접속 허용 IP (쉼표 구분) |
| `OTP_SECRET_KEY`, `JUMIN_SECRET_KEY` | 민감 정보 암호화 키 (서로 다른 키) |
| `DISCORD_WEBHOOK_URL`, `SLACK_WEBHOOK_URL` | 알림 |

## 4. 트러블슈팅

### 부팅 시 로그 테이블 전체 탐색 → 정책 테이블에 점수 저장
- **현상**: 엔진 부팅 때 과거 AI 점수를 복구하려고 커지는 `web_access_log` 를 전체 탐색해 부팅 지연·DB 부하.
- **해결**: 정책 테이블(`whitelist_addr`, `blacklist_addr`)에 `ai_score` 를 두고, 초기 동기화는 정책 테이블에서 바로 조회.

### 로그 건별 저장 → 묶음 저장
- 엔진 쪽 프록시가 로그를 100건 또는 1초 단위로 묶어 보내고, 8080 백엔드가 `executemany` 로 한 번에 INSERT. 측정 결과는 Captive 저장소의 측정 도구(`pcap_engine/measure/m4_batch_bench.py`)로 잰 뒤 기입 예정.

## 5. 알려진 한계와 개선 계획

| 한계 | 개선 방향 |
|---|---|
| `pcap_checker.py`(8080)는 내장 `socket` 으로 직접 구현 — **요청을 한 번에 하나씩** 처리하고 HTTP 를 수동 파싱. 로그 묶음 저장 중에는 로그인 검증 요청이 대기 | Django 뷰로 옮겨 별도 Gunicorn(8080)으로 실행, IP 허용은 미들웨어로 |
| 로그 묶음을 받아도 로그 1건마다 세션(`OnlineListLog`)·화이트리스트를 조회 (N+1 SELECT) | 묶음 안의 호스트·도메인을 한 번에 조회 |
| 로그 누적에 따라 로그 조회 페이지가 느려짐 | 페이지네이션·인덱스·기간별 파티셔닝 |
| 엔진 쪽 주소·허용 IP 일부가 코드에 고정 (`ALLOWED_IPS`, 프록시 URL) | 환경변수로 이전, 사람별 테스트 DB |
