import os
from pathlib import Path

import pymysql
from dotenv import load_dotenv

# PyMySQL을 MySQL 드라이버로 사용하도록 설정
pymysql.install_as_MySQLdb()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# 서버 배포 및 로컬 테스트 공통
# 프로젝트 루트 경로에 있는 .env 파일을 자동으로 읽어옵니다.
load_dotenv(os.path.join(BASE_DIR, ".env"))

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]

# .env 파일에 DEBUG=True가 있을 때만 켜지고, 없으면(실서버) 안전하게 꺼짐
DEBUG = os.environ.get("DEBUG", "False") == "True"

# 1. 외부 도메인 접속 허용
ALLOWED_HOSTS = [
    "192.168.1.23", #잠깐 테스트용 추후에 app.jsx파일에서 DEV_NODE = false만드는것처럼 지워야함
    "localhost",
    "127.0.0.1",
    "securetechkg.digital",
    "api.securetechkg.digital",
    "portal.securetechkg.digital",
    "*",
]

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "api",
    "rest_framework",
    "corsheaders",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

# React 빌드 파일(dist) 경로를 템플릿 디렉토리에 추가
FRONTEND_DIST_DIR = os.path.join(BASE_DIR, "frontend", "dist")

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [FRONTEND_DIST_DIR],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# =====================================================================
# 데이터베이스 설정
# 원격 DB 서버(192.168.4.15) 연동 설정
# =====================================================================
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": "internal_db",
        "USER": "ubuntu",
        "PASSWORD": os.environ["DB_PASSWORD"],
        "HOST": "192.168.4.15",
        "PORT": "3306",
        # 요청마다 DB에 새로 연결하지 않고 재사용 (끊긴 연결은 확인 후 다시 연결)
        "CONN_MAX_AGE": 60,
        "CONN_HEALTH_CHECKS": True,
        "OPTIONS": {
            "charset": "utf8mb4",
            "connect_timeout": 10,  # 연결 대기 시간 설정
        },
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Internationalization
LANGUAGE_CODE = "ko-kr"
TIME_ZONE = "Asia/Seoul"
USE_I18N = True
USE_TZ = False

# Static files (CSS, JavaScript, Images)
STATIC_URL = "static/"

# React 빌드 시 생성되는 assets 폴더를 정적 파일 경로에 추가
STATICFILES_DIRS = [
    os.path.join(FRONTEND_DIST_DIR, "assets"),
]

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://192.168.3.23",
    "http://192.168.3.23:8000",
    "https://securetechkg.digital",
    "https://api.securetechkg.digital",
    "https://portal.securetechkg.digital",
]

CORS_ALLOWED_ORIGINS += [
    "http://192.168.3.23:80",
    "http://192.168.3.23",
]

# 대시보드 API에서 사용할 캐시 설정
CACHES = {
    # gunicorn 작업자 4개가 같은 값을 보도록 메모리가 아닌 파일에 저장 (재시작해도 유지)
    "default": {
        "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
        "LOCATION": BASE_DIR / "cache_data",
        # 항목이 많아져도 사원 차단 상태가 임의로 지워지지 않게 한도를 넉넉히 둔다
        "OPTIONS": {"MAX_ENTRIES": 100000},
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    "x-user-id",  # ✅ 핵심: 이 커스텀 헤더를 추가해야 CORS 에러가 해결됩니다.
]
