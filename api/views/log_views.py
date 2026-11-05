import traceback

from django.core.cache import cache
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import (
    BlacklistAddr,
    OnlineIpMacMismatchLog,
    OnlineListLog,
    WebAccessLog,
    WhitelistAddr,
)
from .audit import audited
from .policy_history import read_policy_history
from .policy_views import verify_admin_auth
from .threshold_history import level_at, load_history
from .utils import (
    ACCESS_JUDGEMENTS,
    DEFAULT_STATIC_WHITELIST,
    SERVER_ERROR_MESSAGE,
    access_category_q,
    employee_ip,
    extract_ip_suffix,
    get_policy_states,
    judge_access,
    logger,
)

MANUAL_CODES = [c for c, (name, _) in ACCESS_JUDGEMENTS.items() if name.startswith("수동")]
AI_CODES = [c for c in ACCESS_JUDGEMENTS if c not in MANUAL_CODES]

MAC_MISMATCH_RELEASED_KEY = "mac_mismatch_released:{}"


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


def _web_log_to_dict(w):
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
    policy, category = judge_access(w.ai_status_code, w.access_flag)
    return {
        "log_id": w.web_access_log_id,
        "type": w.access_flag,
        "status": category,
        "violator": f"{emp.name} ({emp.employee_id})" if emp else "내부 단말",
        "ip": employee_ip(ip_val) if ip_val else "-",
        "mac": getattr(w.online_list_log, "online_mac_addr", None) or "-"
        if getattr(w.online_list_log, "online_mac_addr", None) else "-",
        "domain": getattr(w, "target_url", "-"),
        "policy": policy,
        "source": "수동" if policy.startswith("수동") else "AI",
        "ai_score": w.ai_score,
        "ai_level": None,  # 최종 페이지로 추려진 뒤에만 계산한다
        "time": w.access_time.strftime("%Y-%m-%d %H:%M:%S") if w.access_time else "-",
        "raw_time": w.access_time,
        "is_mismatch": False,
    }


def _mac_log_to_dict(m):
    session = m.online_list_log
    emp = session.employee if session and session.employee else None
    return {
        "type": "차단",
        "status": "차단",
        "violator": f"{emp.name} ({emp.employee_id})" if emp else "내부 단말",
        "ip": employee_ip(session.online_ip) if session else "-",
        "mac": m.mismatch_mac_addr or "-",
        "domain": "MAC 불일치",
        "policy": "MAC 스푸핑",
        "source": "AI",
        "ai_score": None,
        "ai_level": "-",
        "time": m.insert_time.strftime("%Y-%m-%d %H:%M:%S") if m.insert_time else "-",
        "raw_time": m.insert_time,
        "mismatch_id": m.pk,
        "is_mismatch": True,
    }


@api_view(["GET"])
def get_integrated_logs(request):
    try:
        # 프론트엔드 필터 및 페이지네이션 파라미터 수신
        page = max(1, int(request.GET.get("page", 1)))
        limit = int(request.GET.get("limit", 10))
        search = request.GET.get("search", "").strip()
        status_filter = request.GET.get("statusFilter", "all")
        sub_filter = request.GET.get("subFilter", "all")
        start_date = request.GET.get("startDate", "")
        end_date = request.GET.get("endDate", "")

        base_web_q = Q()
        base_mac_q = Q()

        if start_date:
            base_web_q &= Q(access_time__gte=f"{start_date} 00:00:00")
            base_mac_q &= Q(insert_time__gte=f"{start_date} 00:00:00")
        if end_date:
            base_web_q &= Q(access_time__lte=f"{end_date} 23:59:59")
            base_mac_q &= Q(insert_time__lte=f"{end_date} 23:59:59")

        if search:
            base_web_q &= (
                Q(online_list_log__employee__name__icontains=search) |
                Q(online_list_log__employee__employee_id__icontains=search) |
                Q(online_list_log__online_ip__icontains=search) |
                Q(target_url__icontains=search)
            )
            base_mac_q &= (
                Q(online_list_log__employee__name__icontains=search) |
                Q(online_list_log__employee__employee_id__icontains=search) |
                Q(online_list_log__online_ip__icontains=search) |
                Q(mismatch_mac_addr__icontains=search)
            )

        # 날짜/검색만 적용한 기준 쿼리셋 (탭과 무관하게 상단 통계 숫자에 쓴다)
        web_base_qs = WebAccessLog.objects.filter(base_web_q)
        mac_base_qs = OnlineIpMacMismatchLog.objects.filter(base_mac_q).select_related(
            "online_list_log__employee"
        )
        mac_base_list = [
            m for m in mac_base_qs if not cache.get(MAC_MISMATCH_RELEASED_KEY.format(m.pk))
        ]

        stats = {
            "total": web_base_qs.count() + len(mac_base_list),
            "allowed": web_base_qs.filter(access_category_q("정상")).count(),
            "blocked": web_base_qs.filter(access_category_q("차단")).count() + len(mac_base_list),
            "ai_suspicious": web_base_qs.filter(access_category_q("의심")).count(),
            "suspicious_blocked": web_base_qs.filter(
                access_category_q("의심"), access_flag="차단"
            ).count(),
        }

        # 상태 탭 + 2차 필터를 DB 쿼리 단계에서 반영한다 (로그가 많아도 Python에서는 보여줄 만큼만 처리)
        status_category = {"허용": "정상", "차단": "차단", "의심": "의심"}.get(status_filter)
        web_q = base_web_q
        if status_category:
            web_q &= access_category_q(status_category)

        include_mac = status_filter in ("all", "차단")
        if sub_filter != "all":
            if status_filter == "의심":
                code = {"화이트 의심": 5, "블랙 의심": 4}.get(sub_filter)
                web_q &= Q(ai_status_code=code) if code else Q(pk__isnull=True)
                include_mac = False
            elif sub_filter == "MAC 스푸핑":
                web_q &= Q(pk__isnull=True)  # 이 탭은 MAC 불일치 건만 보여준다
            elif sub_filter == "AI":
                web_q &= Q(ai_status_code__in=AI_CODES)
                include_mac = False
            elif sub_filter == "수동":
                # NOT IN은 NULL을 안 걸러서, 코드 없는(NULL) 행도 수동으로 보도록 명시한다
                web_q &= (
                    Q(ai_status_code__in=MANUAL_CODES)
                    | Q(ai_status_code__isnull=True)
                    | ~Q(ai_status_code__in=list(ACCESS_JUDGEMENTS))
                )
                include_mac = False

        web_filtered_qs = (
            WebAccessLog.objects.select_related("online_list_log__employee")
            .filter(web_q)
            .order_by("-access_time")
        )
        web_count = web_filtered_qs.count()

        mac_list = []
        if include_mac:
            mac_list = [
                m
                for m in mac_base_qs
                if not cache.get(MAC_MISMATCH_RELEASED_KEY.format(m.pk))
            ]
        total_count = web_count + len(mac_list)
        total_pages = max(1, (total_count + limit - 1) // limit)
        page = min(page, total_pages)
        offset = (page - 1) * limit

        # mac_list는 항상 작아서 통째로 들고, web은 이번 페이지 끝까지만 가져온다
        web_slice = list(web_filtered_qs[: offset + limit]) if web_count else []
        combined = [_web_log_to_dict(w) for w in web_slice] + [
            _mac_log_to_dict(m) for m in mac_list
        ]
        combined.sort(
            key=lambda x: x["raw_time"].timestamp() if x["raw_time"] else 0,
            reverse=True,
        )
        page_logs = combined[offset : offset + limit]

        threshold_history = load_history()
        for row in page_logs:
            if not row["is_mismatch"]:
                row["ai_level"] = level_at(row["raw_time"], threshold_history) or "-"

        ai_data = []
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
            {
                "status": "success",
                "stats": stats,
                "total_pages": total_pages,
                "current_page": page,
                "general_logs": page_logs,
                "ai_data": ai_data,
            }
        )
    except Exception as e:
        logger.error(f"통합 로그 조회 오류: {e}")
        return Response(
            {"status": "error", "message": SERVER_ERROR_MESSAGE}, status=500
        )


@api_view(["POST"])
@audited("MAC 스푸핑 해제", "mismatch_id", actor_key="employee_id")
def release_mac_mismatch(request):
    """DB를 바꾸지 않고, 확인 완료한 MAC 불일치 건을 목록에서만 뺀다."""
    try:
        is_valid, error_msg = verify_admin_auth(
            request, request.data.get("employee_id"), request.data.get("password")
        )
        if not is_valid:
            return Response({"status": "error", "message": error_msg}, status=403)

        mismatch_id = request.data.get("mismatch_id")
        if not OnlineIpMacMismatchLog.objects.filter(pk=mismatch_id).exists():
            return Response({"status": "error", "message": "해당 기록을 찾을 수 없습니다."}, status=404)

        cache.set(MAC_MISMATCH_RELEASED_KEY.format(mismatch_id), True, None)
        return Response({"status": "success", "message": "MAC 스푸핑 건을 해제했습니다."})
    except Exception as e:
        logger.error("MAC 스푸핑 해제 처리 실패: %s", e)
        return Response({"status": "error", "message": SERVER_ERROR_MESSAGE}, status=500)