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

# 💡 [수정] 통합된 정책 모델 2개와 OnlineList만 import
from ..models import BlacklistAddr, OnlineList, WhitelistAddr

logger = logging.getLogger(__name__)
RESTRICTED_IDS = {"admin", "root", "manager", "test", "guest"}
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


def get_client_ip(request):
    xf = request.META.get("HTTP_X_FORWARDED_FOR")
    return (
        xf.split(",")[0].strip() if xf else request.META.get("REMOTE_ADDR", "127.0.0.1")
    )


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


def sync_pcap_json_files(sync_type="all"):
    with file_lock:
        try:
            # 💡 [수정] 통합 BlacklistAddr만 조회
            blacklists = [
                p.blacklist_domain
                # 블랙 의심은 관리자 판단 전까지 차단하지 않으므로 엔진 목록에서 제외
                for p in BlacklistAddr.objects.filter(deleted_at__isnull=True).exclude(
                    source="의심"
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

            # 💡 [수정] 통합 WhitelistAddr만 조회
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
                        for l in OnlineList.objects.select_related("employee")[:100]
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
                    for l in OnlineList.objects.select_related("employee")[:100]
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
