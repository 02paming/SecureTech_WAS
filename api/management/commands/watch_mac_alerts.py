import time

from django.conf import settings
from django.core.cache import cache
from django.core.management.base import BaseCommand
from django.db import close_old_connections
from django.db.models import Max

from api.models import OnlineIpMacMismatchLog
from api.views.alert_services import send_mac_mismatch_alert
from api.views.policy_history import record_policy_changes, touch_heartbeat
from api.views.utils import logger

POLL_SECONDS = 10
BATCH_SIZE = 50
COOLDOWN_SECONDS = 600  # 같은 접속의 같은 MAC은 10분에 한 번만 경보
STATE_FILE = settings.BASE_DIR / "cache_data" / "mac_alert_last_id"


def _load_last_id():
  try:
    return int(STATE_FILE.read_text())
  except (OSError, ValueError):
    return None


def _save_last_id(last_id):
  STATE_FILE.parent.mkdir(exist_ok=True)
  STATE_FILE.write_text(str(last_id))


def process_new_alerts():
  """엔진이 새로 기록한 MAC 불일치 행을 경보한다. 보낸 경보 수를 돌려준다."""
  last_id = _load_last_id()
  if last_id is None:
    # 처음 실행할 때는 지난 기록을 한꺼번에 보내지 않고 지금부터 감시한다
    latest = OnlineIpMacMismatchLog.objects.aggregate(m=Max("pk"))["m"] or 0
    _save_last_id(latest)
    return 0

  rows = (
    OnlineIpMacMismatchLog.objects.filter(pk__gt=last_id)
    .select_related("online_list_log__employee")
    .order_by("pk")[:BATCH_SIZE]
  )
  sent = 0
  for row in rows:
    log = row.online_list_log
    key = f"mac_alert:{log.pk}:{row.mismatch_mac_addr}"
    if cache.get(key) is None:
      employee = log.employee
      ok = send_mac_mismatch_alert(
        f"{employee.name} ({employee.employee_id})" if employee else "내부 단말",
        f"192.168.2.{log.online_ip}",
        log.online_mac_addr,
        row.mismatch_mac_addr,
        row.insert_time.strftime("%Y-%m-%d %H:%M:%S"),
      )
      # 전송에 실패하면 이 행부터 다음 주기에 다시 시도한다
      if not ok:
        break
      cache.set(key, 1, COOLDOWN_SECONDS)
      sent += 1
    last_id = row.pk
  _save_last_id(last_id)
  return sent


class Command(BaseCommand):
  help = "상시 실행: MAC 변조 행을 Discord로 경보하고 정책 변경 이력을 기록"

  def handle(self, *args, **options):
    while True:
      close_old_connections()
      touch_heartbeat()
      try:
        process_new_alerts()
      except Exception as e:
        logger.error("MAC 변조 경보 처리 오류: %s", e)
      try:
        record_policy_changes()
      except Exception as e:
        logger.error("정책 이력 기록 오류: %s", e)
      time.sleep(POLL_SECONDS)
