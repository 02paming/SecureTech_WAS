import json
import logging
import os
import re
import socket
import threading
import urllib.request

from cryptography.fernet import Fernet, InvalidToken
from django.core.cache import cache
from django.db import DatabaseError, connection, connections
from django.db.models import Q

from ..models import BlacklistAddr, OnlineList, WhitelistAddr

file_lock = threading.Lock()
logger = logging.getLogger(__name__)
PCAP_BACKEND_URL = os.getenv("PCAP_BACKEND_URL", "http://127.0.0.1:8080")
_otp_fernet = Fernet(os.environ["OTP_SECRET_KEY"].encode())


def encrypt_otp_secret(raw_secret):
    return _otp_fernet.encrypt(raw_secret.encode()).decode()


def decrypt_otp_secret(stored_value):
    """DB에 평문으로 남아 있던 기존 값도 그대로 쓸 수 있게 복호화 실패 시 원문을 돌려준다."""
    try:
        return _otp_fernet.decrypt(stored_value.encode()).decode()
    except (InvalidToken, UnicodeDecodeError, ValueError):
        return stored_value


EMPLOYEE_IP_PREFIX = "192.168.2."
RESTRICTED_IDS = {"admin", "root", "manager", "test", "guest"}
ANONYMIZED_ID_PREFIX = "deleted_"
DEFAULT_STATIC_WHITELIST = {
    "localhost",
    "127.0.0.1",
    "st.co.kr",
    "securetech.co.kr",
    "gw.st.co.kr",
}

SERVER_ERROR_MESSAGE = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."
DUPLICATE_MEMBER_MESSAGE = "이미 등록된 아이디, 이메일, 전화번호 또는 주민등록번호입니다."


def format_jumin_and_birth(jumin):
    c = re.sub(r"[^0-9]", "", str(jumin))
    return (
        (
            f"{'20' if c[6] in '34' else '19'}{c[0:2]}년 {c[2:4]}월 {c[4:6]}일",
            f"{c[0:6]}-{c[6]}******",
        )
        if len(c) >= 7
        else ("정보 없음", "[RRN Omitted]")
    )


LOCAL_PROXIES = {"127.0.0.1", "::1"}


def get_client_ip(request):
    remote = request.META.get("REMOTE_ADDR", "127.0.0.1")
    if remote not in LOCAL_PROXIES:
        return remote
    forwarded = [
        ip.strip()
        for ip in request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")
        if ip.strip()
    ]
    for ip in reversed(forwarded):
        if ip not in LOCAL_PROXIES:
            return ip
    return remote


def employee_ip(suffix):
    """DB에는 사원 단말 IP의 마지막 자리만 저장한다."""
    return f"{EMPLOYEE_IP_PREFIX}{suffix}"


def extract_ip_suffix(ip_str):
    t = str(ip_str).split(".")[-1].strip()
    return int(t) if t.isdigit() else 1


def generate_pseudo_mac(emp_id, sfx):
    h = abs(hash(str(emp_id))) % 0xFFFFFF
    return f"00:1A:2B:{h >> 16:02X}:{(h >> 8) & 0xFF:02X}:{int(sfx):02X}"


def save_online_session(emp, sfx, now):
    mac = generate_pseudo_mac(emp.employee_id, sfx)
    with connection.cursor() as c:
        c.execute("DELETE FROM online_list WHERE employee_id=%s", [emp.employee_number])
        for t in ["online_list", "online_list_log"]:
            try:
                c.execute(
                    f"INSERT INTO {t} (employee_id,online_ip,online_mac_addr,login_time) VALUES (%s,%s,%s,%s)",
                    [emp.employee_number, sfx, mac, now],
                )
            except DatabaseError:
                c.execute(
                    f"INSERT INTO {t} (employee_id,online_ip,login_time) VALUES (%s,%s,%s)",
                    [emp.employee_number, sfx, now],
                )


def resolve_domain_ip(domain):
    try:
        return socket.gethostbyname(domain) if domain else "0.0.0.0"
    except OSError:
        return "0.0.0.0"


WHITE_POLICY_LABELS = {"USER": "수동 허용", "AI": "AI 안전", "DOUBT": "화이트 의심"}
BLACK_POLICY_LABELS = {"USER": "수동 차단", "AI": "AI 위험", "DOUBT": "블랙 의심"}


def get_policy_states():
    states = {}
    for domain, source, is_protected in WhitelistAddr.objects.filter(
        deleted_at__isnull=True
    ).values_list("whitelist_domain", "source", "is_protected"):
        states[domain] = {
            "label": "보호 허용"
            if is_protected
            else WHITE_POLICY_LABELS.get(source, source),
            "source": source,
        }
    for domain, source in BlacklistAddr.objects.filter(
        deleted_at__isnull=True
    ).values_list("blacklist_domain", "source"):
        states[domain] = {
            "label": BLACK_POLICY_LABELS.get(source, source),
            "source": source,
        }
    return states


# web_access_log.ai_status_code: 접속 시점의 판정 (이름, 집계 구분)
ACCESS_JUDGEMENTS = {
    1: ("수동 차단", "차단"),
    2: ("수동 허용", "정상"),
    3: ("AI 차단", "차단"),
    4: ("블랙 의심", "의심"),
    5: ("화이트 의심", "의심"),
    6: ("AI 안전", "정상"),
}


def judge_access(status_code, access_flag):
    """접속 시점의 판정 이름과 집계 구분을 돌려준다. 코드가 없으면 수동 정책 기록으로 본다."""
    if status_code in ACCESS_JUDGEMENTS:
        return ACCESS_JUDGEMENTS[status_code]
    return ("수동 차단", "차단") if access_flag == "차단" else ("수동 허용", "정상")


def access_category_q(category):
    """judge_access와 같은 기준으로 DB에서 집계 구분을 거르는 조건을 돌려준다."""
    codes = [c for c, (_, cat) in ACCESS_JUDGEMENTS.items() if cat == category]
    query = Q(ai_status_code__in=codes)
    no_code = ~Q(ai_status_code__in=list(ACCESS_JUDGEMENTS))
    if category == "차단":
        return query | (no_code & Q(access_flag="차단"))
    if category == "정상":
        return query | (no_code & ~Q(access_flag="차단"))
    return query


def is_admin_ip_allowed(ip):
    """ADMIN_ALLOWED_IPS가 비어 있으면 제한하지 않는다. 시연 전에 .env에 주소를 넣어 막는다."""
    allowed = os.getenv("ADMIN_ALLOWED_IPS", "").strip()
    if not allowed:
        return True
    return ip in {item.strip() for item in allowed.split(",")}


def sync_pcap_json_files(sync_type="all"):
    with file_lock:
        try:
            blacklists = [
                p.blacklist_domain
                for p in BlacklistAddr.objects.filter(deleted_at__isnull=True)
            ]

            with open("blacklist_addr.json", "w", encoding="utf-8") as f:
                json.dump(
                    [
                        {
                            "blacklist_domain": domain,
                            "no_access_ip": resolve_domain_ip(domain),
                        }
                        for domain in set(blacklists)
                    ],
                    f,
                )

            whitelists = [
                w.whitelist_domain
                for w in WhitelistAddr.objects.filter(deleted_at__isnull=True)
            ]

            with open("whitelist_addr.json", "w", encoding="utf-8") as f:
                json.dump(
                    [{"whitelist_domain": domain} for domain in set(whitelists)],
                    f,
                )

            with open("online_ip.json", "w", encoding="utf-8") as f:
                json.dump(
                    [
                        {
                            "employee_id": l.employee.employee_id,
                            "online_ip": l.online_ip,
                        }
                        for l in OnlineList.objects.select_related("employee")
                        if l.employee
                    ],
                    f,
                )
            try:
                data = json.dumps({"sync_type": sync_type}).encode("utf-8")
                req = urllib.request.Request(
                    f"{PCAP_BACKEND_URL}/api/sync_domains",
                    data=data,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                urllib.request.urlopen(req, timeout=2)
            except Exception as e:
                logger.warning(f"PCAP API 실패: {e}")
        except Exception as e:
            logger.error(f"Sync IO 실패: {e}")


def sync_expire_to_pcap(emp_id, kick_ip):
    if not kick_ip:
        return
    try:
        with open("online_ip.json", "w", encoding="utf-8") as f:
            json.dump(
                [
                    {"employee_id": l.employee.employee_id, "online_ip": l.online_ip}
                    for l in OnlineList.objects.select_related("employee")
                    if l.employee
                ],
                f,
            )
        urllib.request.urlopen(
            urllib.request.Request(
                f"{PCAP_BACKEND_URL}/api/expire_user",
                data=json.dumps({"emp_id": emp_id, "kick_host_id": kick_ip}).encode(
                    "utf-8"
                ),
                headers={"Content-Type": "application/json"},
                method="POST",
            ),
            timeout=2,
        )
    except Exception as e:
        logger.error(f"Expire 킥 실패: {e}")


def sync_pcap_json_files_in_background():
    def run():
        try:
            sync_pcap_json_files()
        finally:
            connections.close_all()

    threading.Thread(target=run).start()


def notify_pcap_delta(sync_type, action, domain):
    try:
        data = json.dumps(
            {"sync_type": sync_type, "action": action, "domain": domain}
        ).encode("utf-8")

        req = urllib.request.Request(
            f"{PCAP_BACKEND_URL}/api/sync_domains",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=3)
        logger.info("PCAP 단건 통보 완료: %s %s %s", sync_type, action, domain)
    except OSError as e:
        logger.warning("PCAP 단건 통보 실패: %s", e)