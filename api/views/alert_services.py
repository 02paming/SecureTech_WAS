# 디스코드 및 슬랙 웹훅을 통한 보안 위협(MAC 스푸핑 등) 긴급 경보 발송 서비스 파일

import os

import requests

from .utils import logger

DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")


def _post_webhook(channel, url, payload):
    # 한 채널이 실패해도 서버가 죽거나 다른 채널 전송이 막히지 않도록 로그만 남긴다
    try:
        requests.post(url, json=payload, timeout=5)
    except requests.RequestException as e:
        logger.warning("MAC 스푸핑 경보 전송 실패 (%s): %s", channel, type(e).__name__)


def send_mac_mismatch_alert(employee, ip, login_mac, mismatch_mac, time_str):
    """
    [긴급] 인가되지 않은 단말(MAC 스푸핑) 접근 시 설정된 채널(Discord, Slack)로 즉시 알림을 발송한다.
    웹훅이 하나도 설정되어 있지 않을 때만 False를 돌려준다.
    """
    if not DISCORD_WEBHOOK_URL and not SLACK_WEBHOOK_URL:
        logger.warning("Discord/Slack Webhook URL이 설정되어 있지 않아 경보를 발송할 수 없습니다.")
        return False

    if DISCORD_WEBHOOK_URL:
        _post_webhook(
            "Discord",
            DISCORD_WEBHOOK_URL,
            {
                "username": "SecureTech 관제",
                "embeds": [
                    {
                        "title": "[긴급 관제] MAC 스푸핑 의심 탐지",
                        "color": 16711680,
                        "fields": [
                            {"name": "대상 사원", "value": employee, "inline": True},
                            {"name": "접속 IP", "value": ip, "inline": True},
                            {"name": "허가된 MAC", "value": login_mac, "inline": False},
                            {"name": "탐지된 MAC", "value": mismatch_mac, "inline": False},
                            {"name": "탐지 시간", "value": time_str, "inline": False},
                        ],
                    }
                ],
            },
        )

    if SLACK_WEBHOOK_URL:
        _post_webhook(
            "Slack",
            SLACK_WEBHOOK_URL,
            {
                "text": (
                    f"🚨 *[긴급 관제] MAC 스푸핑 의심 탐지*\n"
                    f"• *대상 사원:* {employee}\n"
                    f"• *접속 IP:* {ip}\n"
                    f"• *허가된 MAC:* `{login_mac}`\n"
                    f"• *탐지된 MAC:* `{mismatch_mac}`\n"
                    f"• *탐지 시간:* {time_str}\n\n"
                    f"⚠️ *조치 요망:* 즉시 해당 IP의 물리적 연결 상태를 확인하세요."
                )
            },
        )

    return True
