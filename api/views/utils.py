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

from ..models import BlacklistAddr, OnlineList, WhitelistAddr

logger = logging.getLogger(__name__)
RESTRICTED_IDS = {"admin", "root", "manager", "test", "guest"}
# 완전 삭제한 사원의 자리표시 아이디. 가입에 쓸 수 없다
ANONYMIZED_ID_PREFIX = "deleted_"
DEFAULT_STATIC_WHITELIST = {
    "localhost",
    "127.0.0.1",
    "st.co.kr",
    "securetech.co.kr",
    "gw.st.co.kr",
}

# DB 오류 원문에는 개인정보가 섞일 수 있으므로 화면에는 이 문구만 보낸다
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
    """요청 IP를 돌려준다. X-Forwarded-For는 위조할 수 있어 같은 서버의 nginx를 거칠 때만 믿는다."""
    remote = request.META.get("REMOTE_ADDR", "127.0.0.1")
    if remote not in LOCAL_PROXIES:
        return remote
    # nginx가 맨 뒤에 붙인 값이 실제 접속 주소다
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
    # 입력값을 그대로 키로 쓰지 않도록 해시로 고정 길이 키를 만든다
    return "blocked_emp:" + hashlib.sha256(str(emp_id).encode()).hexdigest()


def is_emp_blocked(emp_id):
    return cache.get(_blocked_key(emp_id)) is not None


def block_emp(emp_id):
    cache.set(_blocked_key(emp_id), True, timeout=None)


def unblock_emp(emp_id):
    cache.delete(_blocked_key(emp_id))


def resolve_domain_ip(domain):
    # DNS 조회가 안 되는 도메인 하나 때문에 전체 동기화가 실패하지 않도록 한다
    try:
        return socket.gethostbyname(domain) if domain else "0.0.0.0"
    except OSError:
        return "0.0.0.0"


WHITE_POLICY_LABELS = {"USER": "수동 허용", "AI": "AI 안전", "DOUBT": "화이트 의심"}
BLACK_POLICY_LABELS = {"USER": "수동 차단", "AI": "AI 위험", "DOUBT": "블랙 의심"}


def get_policy_states():
    """활성 정책의 도메인별 정책 판단 이름과 출처를 돌려준다."""
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
    """현재 정책 기준의 차단 도메인과 의심 도메인을 돌려준다."""
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


def classify_access(access_flag, domain, blocked_domains, suspect_domains):
    """접속 기록을 정상·의심·차단 중 하나로 나눈다.

    로그 원본은 고치지 않고, 통과했던 기록도 도메인이 지금 차단 정책이면 차단으로 집계한다.
    """
    if access_flag == "차단" or domain in blocked_domains:
        return "차단"
    if domain in suspect_domains:
        return "의심"
    return "정상"


def sync_pcap_json_files(sync_type="all"):
    with file_lock:
        try:
            # 통합 BlacklistAddr만 조회
            blacklists = [
                p.blacklist_domain
                # 블랙 의심은 관리자 판단 전까지 차단하지 않으므로 엔진 목록에서 제외
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

            # 통합 WhitelistAddr만 조회
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
            # 스레드가 연 DB 연결은 자동으로 재사용되지 않으므로 바로 닫는다
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
