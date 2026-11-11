# 정책 테이블의 변화를 감지하고 파일 기반의 정책 변경 이력 및 스냅샷을 관리하는 파일

import json
import time

from django.conf import settings
from django.db import connection

from .utils import get_policy_states

# DB를 바꾸지 않고 정책 테이블의 변화를 비교해 파일에 남긴다. 엔진이 직접 바꾼 값도 기록된다
HISTORY_DIR = settings.BASE_DIR / "policy_history_data"
HISTORY_FILE = HISTORY_DIR / "policy_history.jsonl"
SNAPSHOT_FILE = HISTORY_DIR / "policy_snapshot.json"
NO_POLICY_BEFORE = "-"
NO_POLICY_AFTER = "정책 해제"
NO_POLICY_LABELS = {NO_POLICY_BEFORE, NO_POLICY_AFTER, "미등록", "미분류"}
HEARTBEAT_FILE = HISTORY_DIR / "watcher_heartbeat"
HEARTBEAT_LIMIT_SECONDS = 60


def touch_heartbeat():
    HISTORY_DIR.mkdir(exist_ok=True)
    HEARTBEAT_FILE.touch()


def is_watcher_alive():
    try:
        return time.time() - HEARTBEAT_FILE.stat().st_mtime < HEARTBEAT_LIMIT_SECONDS
    except OSError:
        return False


def _actor(source):
    return "AI 엔진" if source in ("AI", "DOUBT") else "관리자"


def _db_now():
    # 엔진이 쓰는 접속 기록과 시간을 맞추기 위해 DB 시간을 쓴다
    with connection.cursor() as cursor:
        cursor.execute("SELECT NOW()")
        return cursor.fetchone()[0].strftime("%Y-%m-%d %H:%M:%S")


def record_policy_changes():
    """지난번과 달라진 도메인 정책을 이력에 추가한다. 추가한 건수를 돌려준다."""
    current = get_policy_states()
    HISTORY_DIR.mkdir(exist_ok=True)
    try:
        previous = json.loads(SNAPSHOT_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        # 처음 실행할 때는 지금 상태를 기준으로 삼고 이후 변경부터 기록한다
        SNAPSHOT_FILE.write_text(json.dumps(current, ensure_ascii=False), encoding="utf-8")
        return 0

    changes = []
    for domain in sorted(set(previous) | set(current)):
        before = previous.get(domain)
        after = current.get(domain)
        before_label = before["label"] if before else NO_POLICY_BEFORE
        after_label = after["label"] if after else NO_POLICY_AFTER
        if before_label != after_label:
            changes.append(
                {
                    "domain": domain,
                    "before": before_label,
                    "after": after_label,
                    # 등록 해제는 관리자 작업으로 본다
                    "actor": _actor(after["source"]) if after else "관리자",
                }
            )
    if changes:
        now = _db_now()
        with HISTORY_FILE.open("a", encoding="utf-8") as f:
            for change in changes:
                f.write(json.dumps({"time": now, **change}, ensure_ascii=False) + "\n")
    SNAPSHOT_FILE.write_text(json.dumps(current, ensure_ascii=False), encoding="utf-8")
    return len(changes)


def read_policy_history(domain):
    """도메인의 정책 변경 이력을 최신순으로 돌려준다. 정책이 잠시 비어 있던 구간은 건너뛰고 잇는다."""
    try:
        lines = HISTORY_FILE.read_text(encoding="utf-8").splitlines()
    except OSError:
        return []
    history = []
    last_policy = None
    for line in lines:
        try:
            row = json.loads(line)
        except ValueError:
            continue
        if row.get("domain") != domain:
            continue
        if last_policy is None and row.get("before") not in NO_POLICY_LABELS:
            last_policy = row.get("before")
        after = row.get("after")
        if after in NO_POLICY_LABELS or after == last_policy:
            continue
        history.append({**row, "before": last_policy or ""})
        last_policy = after
    history.reverse()
    return history
