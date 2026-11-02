import hashlib
import json
import logging
import re
import socket
import threading
import urllib.request

file_lock = threading.Lock()

from django.core.cache import cache
from django.db import connection, connections

from ..models import AiThresholdConfig, BlacklistAddr, OnlineList, WhitelistAddr

logger = logging.getLogger(__name__)
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
            except:
                c.execute(
                    f"INSERT INTO {t} (employee_id,online_ip,login_time) VALUES (%s,%s,%s)",
                    [emp.employee_number, sfx, now],
                )


def _blocked_key(emp_id):
    return "blocked_emp:" + hashlib.sha256(str(emp_id).encode()).hexdigest()


def is_emp_blocked(emp_id):
    return cache.get(_blocked_key(emp_id)) is not None


def block_emp(emp_id):
    cache.set(_blocked_key(emp_id), True, timeout=None)


def unblock_emp(emp_id):
    cache.delete(_blocked_key(emp_id))


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


def get_policy_domain_sets():
    blocked = set(
        BlacklistAddr.objects.filter(
            deleted_at__isnull=True, source__in=["USER", "AI"]
        ).values_list("blacklist_domain", flat=True)
    )
    suspect = set(
        WhitelistAddr.objects.filter(
            deleted_at__isnull=True, source="DOUBT"
        ).values_list("whitelist_domain", flat=True)
    ) | set(
        BlacklistAddr.objects.filter(
            deleted_at__isnull=True, source="DOUBT"
        ).values_list("blacklist_domain", flat=True)
    )
    return blocked, suspect


def get_ai_thresholds():
    try:
        config = AiThresholdConfig.objects.first()
        if config:
            return config.white_doubt_limit, config.black_doubt_limit, config.black_limit + 1
    except Exception as e:
        logger.error(f"임계값 DB 조회 실패: {e}")
    return 31, 51, 71


def classify_access(access_flag, domain, blocked_domains, suspect_domains, ai_score=None):
    white_start, black_start, block_start = get_ai_thresholds()
    
    if ai_score is not None and ai_score >= 0:
        if ai_score < white_start:
            return "정상"
        elif ai_score < block_start:
            return "의심"
        else:
            return "차단"

    if access_flag == "차단" or domain in blocked_domains:
        return "차단"
        
    if access_flag == "정상":
        return "정상"

    if domain in suspect_domains:
        return "의심"
        
    return "정상"


def sync_pcap_json_files(sync_type="all"):
    with file_lock:
        try:
            blacklists = [
                p.blacklist_domain
                for p in BlacklistAddr.objects.filter(deleted_at__isnull=True).exclude(
                    source="DOUBT"
                )
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
                    "http://127.0.0.1:8080/api/sync_domains",
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
                "http://127.0.0.1:8080/api/expire_user",
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
            "http://127.0.0.1:8080/api/sync_domains",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=3)
        print(
            f"  [웹 백엔드 -> 멍텅구리] {sync_type.upper()} 단건 통보 완료: {action} {domain}"
        )
    except Exception as e:
        print(f"  [웹 백엔드 -> 멍텅구리] 단건 통보 실패: {e}")