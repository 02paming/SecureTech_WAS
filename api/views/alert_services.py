import os

import requests

from .utils import logger

DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")


def send_mac_mismatch_alert(employee, ip, login_mac, mismatch_mac, time_str):
    """MAC 변조 경보를 Discord로 보낸다. 전송에 실패하면 False를 돌려준다."""
    if not DISCORD_WEBHOOK_URL:
        logger.warning("DISCORD_WEBHOOK_URL이 없어 MAC 변조 경보를 보내지 못했습니다.")
        return False
    payload = {
        "username": "SecureTech 관제",
        "embeds": [
            {
                "title": "[긴급] MAC 변조 탐지",
                "color": 16711680,
                "fields": [
                    {"name": "사원", "value": employee, "inline": True},
                    {"name": "IP", "value": ip, "inline": True},
                    {"name": "접속 MAC", "value": login_mac, "inline": False},
                    {"name": "탐지 MAC", "value": mismatch_mac, "inline": False},
                    {"name": "탐지 시간", "value": time_str, "inline": False},
                ],
            }
        ],
    }
    try:
        res = requests.post(DISCORD_WEBHOOK_URL, json=payload, timeout=5)
    except requests.RequestException as e:
        logger.warning("MAC 변조 경보 전송 실패: %s", type(e).__name__)
        return False
    if not res.ok:
        logger.warning("MAC 변조 경보 전송 실패: HTTP %s", res.status_code)
        return False
    return True
