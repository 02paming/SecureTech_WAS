# AI 판별 기준 레벨의 변화를 감지하고 파일 기반의 이력 추적 및 시점별 레벨 조회를 담당하는 파일

import json

from django.conf import settings
from django.db import connection

from ..models import AiThresholdConfig

# DB를 바꾸지 않고 활성 판별 기준 레벨의 변화를 비교해 파일에 남긴다 (policy_history.py와 같은 방식)
HISTORY_DIR = settings.BASE_DIR / "policy_history_data"
THRESHOLD_HISTORY_FILE = HISTORY_DIR / "threshold_history.jsonl"
THRESHOLD_SNAPSHOT_FILE = HISTORY_DIR / "threshold_snapshot.json"

THRESHOLD_LEVEL_NAMES = ["완화", "표준", "엄격"]


def _db_now():
    # 엔진이 쓰는 접속 기록과 시간을 맞추기 위해 DB 시간을 쓴다
    with connection.cursor() as cursor:
        cursor.execute("SELECT NOW()")
        return cursor.fetchone()[0].strftime("%Y-%m-%d %H:%M:%S")


def get_threshold_levels():
    """판별 기준 행을 config_id 순으로 이름 붙여 돌려준다. 숫자를 수정해도 레벨 이름은
    행(config_id)에 고정되어 바뀌지 않는다. 가장 최근에 적용(updated_at)된 행이 현재 활성 레벨이다."""
    configs = list(AiThresholdConfig.objects.order_by("config_id"))
    if not configs:
        return []
    active = max(configs, key=lambda c: c.updated_at)
    levels = []
    for idx, c in enumerate(configs):
        name = THRESHOLD_LEVEL_NAMES[idx] if idx < len(THRESHOLD_LEVEL_NAMES) else f"레벨{idx + 1}"
        levels.append(
            {
                "config_id": c.config_id,
                "level": name,
                "white_start": c.white_doubt_limit,
                "black_start": c.black_doubt_limit,
                "block_start": c.black_limit,
                "active": c.config_id == active.config_id,
            }
        )
    return levels


def record_threshold_changes():
    """활성 레벨이 바뀌면 이력에 남긴다. 처음 실행할 때도 현재 레벨을 기준점으로 바로 남긴다
    (정책 이력과 달리, 로그 조회 시 시작부터 바로 짝지을 수 있어야 하기 때문)."""
    levels = get_threshold_levels()
    current = next((lv["level"] for lv in levels if lv["active"]), None)
    if current is None:
        return 0

    HISTORY_DIR.mkdir(exist_ok=True)
    try:
        previous = json.loads(THRESHOLD_SNAPSHOT_FILE.read_text(encoding="utf-8")).get("level")
    except (OSError, ValueError):
        previous = None

    if current == previous:
        return 0

    with THRESHOLD_HISTORY_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"time": _db_now(), "level": current}, ensure_ascii=False) + "\n")
    THRESHOLD_SNAPSHOT_FILE.write_text(json.dumps({"level": current}, ensure_ascii=False), encoding="utf-8")
    return 1


def load_history():
    """이력 전체를 (시각, 레벨) 목록으로 돌려준다. 로그를 여러 건 조회할 때 한 번만 읽어 재사용한다."""
    try:
        lines = THRESHOLD_HISTORY_FILE.read_text(encoding="utf-8").splitlines()
    except OSError:
        return []
    history = []
    for line in lines:
        try:
            row = json.loads(line)
        except ValueError:
            continue
        history.append((row.get("time", ""), row.get("level")))
    return history


def level_at(access_time, history=None):
    """주어진 시각에 적용 중이었던 레벨 이름. 이력이 쌓이기 전 시각이면 None."""
    if access_time is None:
        return None
    if history is None:
        history = load_history()

    target = access_time.strftime("%Y-%m-%d %H:%M:%S")
    result = None
    for time_str, level in history:
        if time_str <= target:
            result = level
        else:
            break
    return result
