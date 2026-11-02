import traceback

from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import BlacklistAddr, OnlineListLog, WebAccessLog, WhitelistAddr
from .policy_history import read_policy_history
from .utils import (
    DEFAULT_STATIC_WHITELIST,
    SERVER_ERROR_MESSAGE,
    employee_ip,
    extract_ip_suffix,
    get_policy_states,
    judge_access,
    logger,
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
            WebAccessLog.objects.create(
                online_list_log=online_log,
                target_url=clean_target,
                access_flag="차단",
                access_time=timezone.now(),
                ai_score=-1.0,
            )
        except Exception as e:
            logger.error(f"ORM 쿼리 생성 실패 처리: {e}")
            from django.db import connection

            with connection.cursor() as cursor:
                log_id = online_log.online_list_log_id if online_log else None
                cursor.execute(
                    "INSERT INTO web_access_log (online_list_log_id, target_url, access_flag, access_time, ai_score) VALUES (%s, %s, %s, %s, %s)",
                    [log_id, clean_target, "차단", timezone.now(), -1.0],
                )
        cache.delete("dashboard_threat_logs")
        return Response({"status": "success"}, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"위협 차단 신고 처리 오류: {e}\n{traceback.format_exc()}")
        return Response(
            {"status": "error", "message": SERVER_ERROR_MESSAGE}, status=500
        )


@api_view(["GET"])
def get_threat_logs(request):
    try:
        combined_logs = []
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


def _build_policy_map():
    return {domain: state["label"] for domain, state in get_policy_states().items()}


def _policy_label(domain, policy_map):
    if domain in policy_map:
        return policy_map[domain]
    return "시스템 기본 허용" if domain in DEFAULT_STATIC_WHITELIST else "-"


@api_view(["GET"])
def get_domain_detail(request, domain):
    try:
        target = domain.strip().lower()
        counts = {"정상": 0, "의심": 0, "차단": 0}
        employees, logs = {}, []
        ai_score = None
        for w in (
            WebAccessLog.objects.filter(target_url=target)
            .select_related("online_list_log__employee")
            .order_by("-access_time")
        ):
            _, access_status = judge_access(w.ai_status_code, w.access_flag)
            counts[access_status] += 1
            if ai_score is None and w.ai_score is not None and w.ai_score >= 0:
                ai_score = w.ai_score

            session = w.online_list_log
            emp = session.employee if session else None
            time_str = (
                w.access_time.strftime("%Y-%m-%d %H:%M:%S") if w.access_time else "-"
            )
            logs.append(
                {
                    "time": time_str,
                    "name": emp.name if emp else "내부 단말",
                    "employee_id": emp.employee_id if emp else None,
                    "ip": employee_ip(session.online_ip) if session else "-",
                    "result": w.access_flag,
                }
            )

            key = emp.employee_id if emp else None
            row = employees.setdefault(
                key,
                {
                    "name": emp.name if emp else "내부 단말",
                    "employee_id": key,
                    "access_count": 0,
                    "blocked_count": 0,
                    "last_access": time_str,
                },
            )
            row["access_count"] += 1
            if access_status == "차단":
                row["blocked_count"] += 1

        return Response(
            {
                "status": "success",
                "data": {
                    "domain": target,
                    "policy": _policy_label(target, _build_policy_map()),
                    "ai_score": ai_score,
                    "total_count": len(logs),
                    "pass_count": counts["정상"],
                    "suspect_count": counts["의심"],
                    "blocked_count": counts["차단"],
                    "first_access": logs[-1]["time"] if logs else None,
                    "last_access": logs[0]["time"] if logs else None,
                    "history": read_policy_history(target),
                    "employees": sorted(
                        employees.values(),
                        key=lambda e: e["access_count"],
                        reverse=True,
                    ),
                    "logs": logs,
                },
            }
        )
    except Exception as e:
        logger.error(f"도메인 상세 조회 오류: {e}")
        return Response(
            {"status": "error", "message": SERVER_ERROR_MESSAGE}, status=500
        )


@api_view(["GET"])
def get_integrated_logs(request):
    try:
        general_logs, ai_data = [], []

        for w in WebAccessLog.objects.select_related(
            "online_list_log__employee"
        ).order_by("-access_time"):
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
            ip_str = employee_ip(ip_val) if ip_val else "-"

            policy, category = judge_access(w.ai_status_code, w.access_flag)

            general_logs.append(
                {
                    "type": w.access_flag,
                    "status": category,  # 집계 구분: 정상, 의심, 차단
                    "violator": f"{emp.name} ({emp.employee_id})"
                    if emp
                    else "내부 단말",
                    "ip": ip_str,
                    "mac": getattr(w.online_list_log, "online_mac_addr", None) or "-"
                    if getattr(w.online_list_log, "online_mac_addr", None)
                    else "-",
                    "domain": getattr(w, "target_url", "-"),
                    "policy": policy,  # 접속 시점의 판정 이름
                    "ai_score": w.ai_score,
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
            deleted_at__isnull=True, source__in=["AI", "DOUBT"]
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
        logger.error(f"통합 로그 조회 오류: {e}")
        return Response(
            {"status": "error", "message": SERVER_ERROR_MESSAGE}, status=500
        )