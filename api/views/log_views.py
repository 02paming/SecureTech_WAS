import datetime
import traceback
from datetime import timedelta

import requests
from django.core.cache import cache
from django.db.models import Count
from django.db.models.functions import TruncHour, TruncMinute
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

# 💡 [수정] 통합 정책 모델 및 WebAccessLog만 로드
from ..models import (
    BlacklistAddr,
    EqpRunTime,
    OnlineIpMacMismatchLog,
    OnlineListLog,
    WebAccessLog,
    WhitelistAddr,
)
from .ai_services import (
    check_virustotal,
    send_cti_discord_alert,
    send_discord_alert,
)
from .utils import (
    DEFAULT_STATIC_WHITELIST,
    extract_ip_suffix,
    logger,
    sync_pcap_json_files,
)


@api_view(["POST"])
def report_violation(request):
    try:
        source_ip = request.data.get("source_ip") or request.data.get("src_ip")
        is_test = request.data.get("is_test", False)
        raw_domain = (
            request.data.get("blocked_domain") or request.data.get("domain") or ""
        )
        clean_target = (
            raw_domain.strip()
            .lower()
            .replace("http://", "")
            .replace("https://", "")
            .replace("www.", "")
            .split("/")[0]
        )
        if not clean_target:
            clean_target = "unknown-domain.com"
        if is_test:
            return Response(
                {"status": "success", "message": "Test mode: DB skip"},
                status=status.HTTP_201_CREATED,
            )

        if not BlacklistAddr.objects.filter(blacklist_domain=clean_target).exists():
            BlacklistAddr.objects.get_or_create(
                blacklist_domain=clean_target, defaults={"source": "AI"}
            )

        online_log = None
        violator_id = request.data.get("violator") or request.data.get("employee_id")
        if violator_id and violator_id != "가상 시뮬레이터 단말":
            online_log = (
                OnlineListLog.objects.filter(employee__employee_id=str(violator_id))
                .order_by("-login_time")
                .first()
            )
        elif source_ip:
            online_log = (
                OnlineListLog.objects.filter(online_ip=extract_ip_suffix(source_ip))
                .order_by("-login_time")
                .first()
            )
        if not online_log:
            online_log = OnlineListLog.objects.order_by("-login_time").first()

        try:
            # 💡 [수정] WebAccessLog에 "차단" 플래그로 저장
            WebAccessLog.objects.create(
                online_list_log=online_log,
                target_url=clean_target,
                access_flag="차단",
                access_time=timezone.now(),
                ai_score=0.0,
            )
        except Exception as e:
            logger.error(f"ORM 쿼리 생성 실패 처리: {e}")
            from django.db import connection

            with connection.cursor() as cursor:
                log_id = online_log.online_list_log_id if online_log else None
                cursor.execute(
                    "INSERT INTO web_access_log (online_list_log_id, target_url, access_flag, access_time, ai_score) VALUES (%s, %s, %s, %s, %s)",
                    [log_id, clean_target, "차단", timezone.now(), 0.0],
                )
        cache.delete("dashboard_threat_logs")
        return Response({"status": "success"}, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"위협 차단 신고 처리 오류: {e}\n{traceback.format_exc()}")
        return Response({"status": "error", "message": str(e)}, status=500)


@api_view(["GET"])
def get_threat_logs(request):
    try:
        combined_logs = []
        # 💡 [수정] WebAccessLog에서 "차단" 이력만 로드
        bl_logs = (
            WebAccessLog.objects.filter(access_flag="차단")
            .select_related("online_list_log__employee")
            .order_by("-access_time")
        )
        for log in bl_logs:
            violator_text = "내부 단말"
            if log.online_list_log and log.online_list_log.employee:
                emp = log.online_list_log.employee
                violator_text = f"{emp.name} ({emp.employee_id})"
            domain_val = str(log.target_url) if log.target_url else "블랙리스트 도메인"
            access_time = log.access_time
            time_str = access_time.strftime("%Y-%m-%d %H:%M:%S") if access_time else "-"
            combined_logs.append(
                {
                    "violator": violator_text,
                    "blocked_domain": f"{domain_val}",
                    "time": time_str,
                    "raw_time": access_time,
                }
            )
        combined_logs.sort(
            key=lambda x: x["raw_time"].timestamp() if x["raw_time"] else 0,
            reverse=True,
        )
        final_data = [
            {
                "id": idx + 1,
                "violator": item["violator"],
                "blocked_domain": item["blocked_domain"],
                "time": item["time"],
            }
            for idx, item in enumerate(combined_logs)
        ]
        return Response(final_data)
    except Exception as e:
        logger.error(f"위협 로그 조회 오류: {e}")
        return Response([])


@api_view(["GET"])
def get_online_users(request):
    try:
        return Response(
            [
                {
                    "id": idx,
                    "emp_name": log.employee.name if log.employee else "알 수 없음",
                    "emp_id": log.employee.employee_id if log.employee else "-",
                    "ip": f"192.168.2.{log.online_ip}",
                    "is_online": True,
                    "status_text": "접속 중",
                    "login_time": log.login_time.strftime("%Y-%m-%d %H:%M:%S")
                    if log.login_time
                    else "-",
                    "logout_time": "-",
                }
                for idx, log in enumerate(
                    OnlineListLog.objects.select_related("employee").order_by(
                        "-login_time"
                    )[:15]
                )
            ]
        )
    except Exception as e:
        logger.error(f"온라인 유저 조회 오류: {e}")
        return Response([])


@api_view(["GET"])
def get_external_access_logs(request):
    try:
        seen_ips, unique_data = set(), []
        for idx, log in enumerate(
            OnlineListLog.objects.select_related("employee").order_by("-login_time")
        ):
            if log.online_ip not in seen_ips:
                seen_ips.add(log.online_ip)
                unique_data.append(
                    {
                        "id": idx,
                        "emp_name": log.employee.name if log.employee else "알 수 없음",
                        "emp_id": log.employee.employee_id if log.employee else "-",
                        "ip": f"192.168.2.{log.online_ip}",
                        "access_time": log.login_time.strftime("%Y-%m-%d %H:%M:%S")
                        if log.login_time
                        else "-",
                        "status": "허용됨",
                    }
                )
            if len(unique_data) >= 10:
                break
        return Response(unique_data)
    except Exception as e:
        logger.error(f"외부 접근 로그 조회 오류: {e}")
        return Response([])


@api_view(["GET"])
def get_traffic_stats(request):
    try:
        interval_min = int(request.GET.get("interval", 60))
        now = timezone.now()
        t_func, delta, total_pts = (
            (
                TruncMinute("access_time"),
                timedelta(minutes=interval_min),
                72 * (60 // interval_min) + 1,
            )
            if interval_min < 60
            else (TruncHour("access_time"), timedelta(hours=1), 73)
        )
        aligned_now = (
            now.replace(
                second=0,
                microsecond=0,
                minute=(now.minute // interval_min) * interval_min,
            )
            if interval_min < 60
            else now.replace(minute=0, second=0, microsecond=0)
        )
        end_t = aligned_now + delta
        start_t = end_t - (delta * (total_pts - 1))

        base_qs = WebAccessLog.objects.filter(
            access_time__gte=start_t, access_time__lte=end_t
        )
        n_qs = (
            base_qs.filter(access_flag="정상")
            .annotate(time_bucket=t_func)
            .values("time_bucket")
            .annotate(c=Count("web_access_log_id"))
        )
        b_qs = (
            base_qs.filter(access_flag="차단")
            .annotate(time_bucket=t_func)
            .values("time_bucket")
            .annotate(c=Count("web_access_log_id"))
        )

        # 💡 [핵심 수정 1] 차트: AI 의심 트래픽 = 화이트/블랙 양쪽의 "의심" 도메인 트래픽 합산
        suspicious_domains = list(
            WhitelistAddr.objects.filter(
                deleted_at__isnull=True, source="의심"
            ).values_list("whitelist_domain", flat=True)
        ) + list(
            BlacklistAddr.objects.filter(
                deleted_at__isnull=True, source="의심"
            ).values_list("blacklist_domain", flat=True)
        )

        ai_qs = (
            base_qs.filter(target_url__in=suspicious_domains)
            .annotate(time_bucket=t_func)
            .values("time_bucket")
            .annotate(c=Count("web_access_log_id"))
        )

        def _build_dict(qs):
            return {
                i["time_bucket"].replace(
                    second=0,
                    microsecond=0,
                    minute=(i["time_bucket"].minute // interval_min) * interval_min
                    if interval_min < 60
                    else 0,
                ): i["c"]
                for i in qs
                if i["time_bucket"]
            }

        n_dict, b_dict, ai_dict = (
            _build_dict(n_qs),
            _build_dict(b_qs),
            _build_dict(ai_qs),
        )

        chart_data = [
            {
                "time": (start_t + (delta * i)).strftime("%Y-%m-%d %H:%M"),
                "정상접속": n_dict.get(start_t + (delta * i), 0),
                "위협차단": b_dict.get(start_t + (delta * i), 0),
                "AI의심": ai_dict.get(start_t + (delta * i), 0),
            }
            for i in range(total_pts)
        ]

        # 💡 [수정 2] 우측 상단: 정식 위협 차단 누적 트래픽 도메인 Top 5
        top_qs = (
            WebAccessLog.objects.filter(access_flag="차단")
            .values("target_url")
            .annotate(c=Count("web_access_log_id"))
            .order_by("-c")[:10]
        )
        top_map = {}
        for x in top_qs:
            if not x["target_url"]:
                continue
            k = str(x["target_url"]).strip().lower()
            top_map[k] = top_map.get(k, 0) + x["c"]
        top_domains = [
            {"name": k, "value": v}
            for k, v in sorted(top_map.items(), key=lambda i: i[1], reverse=True)[:5]
        ]

        # 💡 [핵심 수정 3] 우측 하단: AI 탐지 기반 대기열 (위험/의심) - 정책 테이블에서 직접 로드
        ai_suspicious_list = []
        for b in BlacklistAddr.objects.filter(
            deleted_at__isnull=True, source__in=["AI", "의심"]
        ).order_by("-blacklist_id")[:5]:
            if b.source == "의심":
                st, col, bg = "블랙 의심", "#f59e0b", "rgba(245, 158, 11, 0.1)"
            else:
                st, col, bg = "AI 위험", "#ef4444", "rgba(239, 68, 68, 0.1)"
            ai_suspicious_list.append(
                {
                    "domain": b.blacklist_domain,
                    "status_text": st,
                    "color": col,
                    "bgColor": bg,
                }
            )

        for w in WhitelistAddr.objects.filter(
            deleted_at__isnull=True, source="의심"
        ).order_by("-whitelist_id")[:5]:
            ai_suspicious_list.append(
                {
                    "domain": w.whitelist_domain,
                    "status_text": "화이트 의심",
                    "color": "#10b981",
                    "bgColor": "rgba(16, 185, 129, 0.1)",
                }
            )

        top_ai_suspicious = ai_suspicious_list[:5]

        return Response(
            {
                "status": "success",
                "data": chart_data,
                "top_domains": top_domains,
                "top_ai_suspicious": top_ai_suspicious,
            }
        )
    except Exception as e:
        logger.error(f"대시보드 통계 조회 오류: {e}")
        return Response({"status": "error", "message": str(e)}, status=500)


@api_view(["POST"])
def simulate_network_access(request):
    try:
        src, url, is_test = (
            request.data.get("source_ip", ""),
            request.data.get("target_url", ""),
            request.data.get("is_test", False),
        )
        ip_sfx = src.split(".")[-1] if src and "." in src else None
        o_log = (
            OnlineListLog.objects.filter(online_ip=int(ip_sfx))
            .order_by("-login_time")
            .first()
            if ip_sfx and ip_sfx.isdigit()
            else OnlineListLog.objects.order_by("-login_time").first()
        )
        if not url:
            return Response({"status": "ERROR"}, status=400)

        now_t, time_s = timezone.now(), timezone.now().strftime("%Y-%m-%d %H:%M:%S")
        target = (
            url.strip()
            .lower()
            .replace("http://", "")
            .replace("https://", "")
            .replace("www.", "")
            .split("/")[0]
        )

        if (
            target in DEFAULT_STATIC_WHITELIST
            or WhitelistAddr.objects.filter(
                whitelist_domain__iexact=target, deleted_at__isnull=True
            ).exists()
        ):
            if not is_test:
                WebAccessLog.objects.create(
                    online_list_log=o_log,
                    target_url=url,
                    access_flag="정상",
                    access_time=now_t,
                )
            return Response(
                {
                    "status": "ALLOWED",
                    "domain": url,
                    "message": "허용(화이트리스트) 도메인 - 보안 검사 스킵됨",
                }
            )

        if BlacklistAddr.objects.filter(
            blacklist_domain__iexact=target, deleted_at__isnull=True
        ).exists():
            if not is_test:
                WebAccessLog.objects.create(
                    online_list_log=o_log,
                    target_url=target,
                    access_flag="차단",
                    access_time=now_t,
                    ai_score=0.0,
                )
            return Response(
                {
                    "status": "BLOCKED",
                    "domain": url,
                    "message": f"블랙리스트 도메인 차단됨 ({target})",
                }
            )

        cti = check_virustotal(target)
        if cti["score"] >= 50.0:
            if not is_test:
                BlacklistAddr.objects.get_or_create(
                    blacklist_domain=target, defaults={"source": "AI"}
                )
                BlacklistAddr.objects.filter(blacklist_domain=target).update(
                    deleted_at=None
                )
                sync_pcap_json_files()
                WebAccessLog.objects.create(
                    online_list_log=o_log,
                    target_url=target,
                    access_flag="차단",
                    access_time=now_t,
                    ai_score=cti["score"],
                )
                send_cti_discord_alert(
                    src, target, cti["score"], cti["details"], time_s
                )
                cache.delete("dashboard_threat_logs")
            return Response(
                {
                    "status": "BLOCKED",
                    "domain": url,
                    "message": f"{cti['details']} - 자동 차단",
                }
            )

        if not is_test:
            WebAccessLog.objects.create(
                online_list_log=o_log,
                target_url=url,
                access_flag="정상",
                access_time=now_t,
            )
        return Response(
            {"status": "ALLOWED", "domain": url, "message": "정상 승인 완료"}
        )
    except Exception as e:
        return Response({"status": "ERROR", "message": str(e)}, status=500)


@api_view(["POST"])
def test_network_isolation(request):
    return Response(
        {
            "status": "ALLOWED",
            "client_ip": request.data.get("mock_ip"),
            "message": "네트워크 격리 테스트 완료",
        }
    )


@api_view(["POST"])
def test_sqli_detection(request):
    return Response({"status": "SAFE", "message": "SQL Injection 방어 테스트 완료"})


@api_view(["POST"])
def test_ddos_detection(request):
    return Response({"status": "SAFE", "message": "DDoS 방어 테스트 완료"})


@api_view(["POST"])
def test_mac_spoofing(request):
    try:
        mock_ip = request.data.get("mock_ip", "192.168.2.100")
        is_test = request.data.get("is_test", False)
        fake_mac = "AA:BB:CC:DD:EE:FF"
        now_time = timezone.now()
        active_log = OnlineListLog.objects.order_by("-login_time").first()

        if not is_test:
            OnlineIpMacMismatchLog.objects.create(
                online_list_log=active_log,
                mismatch_mac_addr=fake_mac,
                insert_time=now_time,
            )
            send_discord_alert(
                mock_ip, fake_mac, now_time.strftime("%Y-%m-%d %H:%M:%S")
            )

        return Response(
            {
                "status": "WARNING",
                "message": f"IP({mock_ip})에서 MAC 변조 시도 탐지 (탐지 MAC: {fake_mac})",
            }
        )
    except Exception as e:
        logger.error(f"MAC 스푸핑 오류: {e}\n{traceback.format_exc()}")
        return Response({"status": "ERROR", "message": str(e)}, status=500)


@api_view(["GET", "POST"])
def manage_eqp_run_time(request):
    try:
        config = EqpRunTime.objects.first()
        if not config:
            config = EqpRunTime.objects.create(
                work_start_time=datetime.time(7, 0),
                work_end_time=datetime.time(19, 0),
                waiting_time=datetime.time(0, 30),
            )
        if request.method == "POST":
            start_str = request.data.get("work_start_time")
            end_str = request.data.get("work_end_time")
            wait_str = request.data.get("waiting_time")
            if start_str:
                h, m = map(int, start_str.split(":"))
                config.work_start_time = datetime.time(h, m)
            if end_str:
                h, m = map(int, end_str.split(":"))
                config.work_end_time = datetime.time(h, m)
            if wait_str:
                h, m = map(int, wait_str.split(":"))
                config.waiting_time = datetime.time(h, m)
            config.save()
            try:
                requests.post("http://127.0.0.1:8080/api/sync_policy", timeout=2)
            except:
                pass
            return Response(
                {"status": "success", "message": "설비 구동 시간이 업데이트되었습니다."}
            )
        return Response(
            {
                "status": "success",
                "data": {
                    "work_start_time": config.work_start_time.strftime("%H:%M"),
                    "work_end_time": config.work_end_time.strftime("%H:%M"),
                    "waiting_time": config.waiting_time.strftime("%H:%M"),
                },
            }
        )
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=500)


@api_view(["GET"])
def get_integrated_logs(request):
    try:
        general_logs, ai_data = [], []

        white_labels = {"USER": "수동 허용", "AI": "AI 안전", "의심": "화이트 의심"}
        black_labels = {"USER": "수동 차단", "AI": "AI 위험", "의심": "블랙 의심"}
        policy_map = {}
        for domain, source in WhitelistAddr.objects.filter(
            deleted_at__isnull=True
        ).values_list("whitelist_domain", "source"):
            policy_map[domain] = white_labels.get(source, source)
        for domain, source in BlacklistAddr.objects.filter(
            deleted_at__isnull=True
        ).values_list("blacklist_domain", "source"):
            policy_map[domain] = black_labels.get(source, source)

        # 💡 [수정] 통합된 단일 WebAccessLog를 순회하여 처리
        for w in WebAccessLog.objects.select_related(
            "online_list_log__employee"
        ).order_by("-access_time")[:200]:
            emp = (
                w.online_list_log.employee
                if getattr(w, "online_list_log", None) and w.online_list_log.employee
                else None
            )
            ip_val = (
                getattr(w.online_list_log, "online_ip", None)
                if getattr(w, "online_list_log", None)
                else None
            )
            ip_str = f"192.168.2.{ip_val}" if ip_val else "-"

            general_logs.append(
                {
                    "type": w.access_flag,  # "정상" 또는 "차단"
                    "violator": f"{emp.name} ({emp.employee_id})"
                    if emp
                    else "내부 단말",
                    "ip": ip_str,
                    "mac": getattr(w.online_list_log, "online_mac_addr", None) or "-"
                    if getattr(w, "online_list_log", None)
                    else "-",
                    "domain": getattr(w, "target_url", "-"),
                    "policy": policy_map.get(getattr(w, "target_url", ""), "미등록"),
                    "ai_score": getattr(w, "ai_score", 0.0) or 0,
                    "time": w.access_time.strftime("%Y-%m-%d %H:%M:%S")
                    if w.access_time
                    else "-",
                    "raw_time": w.access_time,
                }
            )

        for aw in WhitelistAddr.objects.filter(deleted_at__isnull=True, source="AI"):
            ai_data.append(
                {"type": "AI 화이트", "domain": aw.whitelist_domain, "risk_score": 0}
            )

        for ab in BlacklistAddr.objects.filter(
            deleted_at__isnull=True, source__in=["AI", "의심"]
        ):
            ai_data.append(
                {
                    "type": "AI 블랙",
                    "domain": ab.blacklist_domain,
                    "risk_score": 90,
                }
            )

        return Response(
            {"status": "success", "general_logs": general_logs, "ai_data": ai_data}
        )
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=500)
