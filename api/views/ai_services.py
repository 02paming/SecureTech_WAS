import os

import requests

from .utils import logger

# 💡 CTI 실연동 최적화 (타임아웃 2초로 묶어 서버 지연 방지)
VT_API_KEY = os.getenv("VT_API_KEY", "YOUR_VIRUSTOTAL_API_KEY_HERE")


def check_virustotal(domain):
    clean = domain.lower()
    if clean in ["127.0.0.1", "localhost", "dga-test.com"] or clean.endswith(".co.kr"):
        return {"score": 0.0, "details": "예외 도메인 스킵"}
    try:
        res = requests.get(
            f"https://www.virustotal.com/api/v3/domains/{clean}",
            headers={"x-apikey": VT_API_KEY},
            timeout=2.0,
        )
        if res.status_code == 200:
            threats = sum(
                res.json()
                .get("data", {})
                .get("attributes", {})
                .get("last_analysis_stats", {})
                .get(k, 0)
                for k in ["malicious", "suspicious"]
            )
            if threats >= 5:
                return {
                    "score": 90.0,
                    "details": f"위협 탐지 (글로벌 벤더 {threats}곳 악성)",
                }
            if threats >= 2:
                return {
                    "score": 60.0,
                    "details": f"의심 (글로벌 벤더 {threats}곳 주의)",
                }
            return {"score": 0.0, "details": "CTI 정상"}
    except (requests.RequestException, ValueError, KeyError) as e:
        logger.warning(f"VT API 실패: {e}")
    if any(k in clean for k in ["evil", "phishing", "malware", "botnet"]):
        return {"score": 85.0, "details": "(Fallback) 악성 룰셋 탐지"}
    return {"score": 0.0, "details": "조회 실패 (기본 패스)"}


WEBHOOK_URL = "https://discord.com/api/webhooks/1562179148418383903/72kry-rakzvpgGax0gRnLwE8SdrQ0cOG-0Px9lggE5kNthmdx05LoKP16PXXPUxGsSbt"


def _send_discord(payload):
    try:
        requests.post(WEBHOOK_URL, json=payload, timeout=2)
    except requests.RequestException:
        pass


def send_cti_discord_alert(ip, domain, score, details, time_str):
    _send_discord(
        {
            "username": "SecureTech CTI",
            "embeds": [
                {
                    "title": "🌍 [CTI] 악성 도메인 차단",
                    "color": 15548997,
                    "fields": [
                        {"name": "IP", "value": ip, "inline": True},
                        {"name": "도메인", "value": domain, "inline": True},
                        {"name": "점수", "value": f"{score}점", "inline": False},
                        {"name": "판정", "value": details, "inline": False},
                    ],
                }
            ],
        }
    )


def send_discord_alert(ip, mac, time_str):
    _send_discord(
        {
            "username": "SecureTech 관제",
            "embeds": [
                {
                    "title": "🚨 [긴급] MAC 스푸핑",
                    "color": 16711680,
                    "fields": [
                        {"name": "IP", "value": ip, "inline": True},
                        {"name": "MAC", "value": mac, "inline": True},
                    ],
                }
            ],
        }
    )


def generate_advisor_message(score, mismatch_cnt, bl_cnt, avg_ai_score=0.0):
    if score >= 90 and mismatch_cnt == bl_cnt == 0:
        return "단말 상태 매우 건전함."
    msg = [
        "**[위험]** 건전성 심각 저하."
        if score < 50
        else (
            "**[주의]** 정책 위반 다수."
            if score < 80
            else "**[관찰]** 비인가 접근 탐지."
        )
    ]
    issues = [
        f"{k} {v}회"
        for k, v in [("MAC변조", mismatch_cnt), ("유해차단", bl_cnt)]
        if v > 0
    ]
    if issues:
        msg.append("탐지 위협: " + ", ".join(issues))
    if avg_ai_score >= 60:
        msg.append(f"**[CTI]** 평균 위협지수 {avg_ai_score:.1f}점 (정밀 검사 요망)")
    elif avg_ai_score >= 30:
        msg.append(f"**[CTI]** 평균 위협지수 {avg_ai_score:.1f}점 (주의)")
    return "\n".join(msg)
