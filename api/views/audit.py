import functools
import json

from django.conf import settings
from django.utils import timezone

from .utils import get_client_ip, logger

# DB를 바꾸지 않고 관리 작업과 인증 시도를 파일에 남긴다. 비밀번호는 기록하지 않는다
AUDIT_DIR = settings.BASE_DIR / "audit_data"
AUDIT_FILE = AUDIT_DIR / "audit.jsonl"


def write_audit(request, action, target, status_code, actor=None):
    row = {
        "time": timezone.now().strftime("%Y-%m-%d %H:%M:%S"),
        "action": action,
        "target": target,
        "result": "성공" if status_code < 400 else "실패",
        "status": status_code,
        "actor": actor or request.headers.get("X-User-Id") or "-",
        "ip": get_client_ip(request),
    }
    # 기록 실패가 실제 작업을 막으면 안 된다
    try:
        AUDIT_DIR.mkdir(exist_ok=True)
        with AUDIT_FILE.open("a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    except OSError as e:
        logger.error("감사 로그 기록 실패: %s", e)


def audited(action, *target_keys, actor_key=None):
    """조회(GET)를 뺀 요청의 작업 이름, 대상, 결과, 요청자, IP를 남긴다."""

    def decorator(view):
        @functools.wraps(view)
        def wrapper(request, *args, **kwargs):
            response = view(request, *args, **kwargs)
            if request.method != "GET":
                target = {key: request.data.get(key) for key in target_keys if request.data.get(key)}
                write_audit(
                    request,
                    action,
                    target,
                    response.status_code,
                    request.data.get(actor_key) if actor_key else None,
                )
            return response

        return wrapper

    return decorator
