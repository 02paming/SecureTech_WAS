# 대시보드 통계, 트래픽 분석, 설비 구동 시간 및 AI 판별 기준/모델 설정을 관리하는 백엔드 API 뷰

import datetime
from datetime import timedelta

import requests
from django.db import transaction
from django.db.models import Count, Max
from django.db.models.functions import TruncHour, TruncMinute
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import (
    AiModelMetrics,
    AiThresholdConfig,
    BlacklistAddr,
    EqpRunTime,
    OnlineListLog,
    WebAccessLog,
    WhitelistAddr,
)
from .audit import audited
from .policy_history import is_watcher_alive
from .policy_views import verify_admin_auth
from .threshold_history import get_threshold_levels
from .utils import (
    PCAP_BACKEND_URL,
    SERVER_ERROR_MESSAGE,
    access_category_q,
    employee_ip,
    judge_access,
    logger,
)

# 정책 판정 구성비 그래프 색(원그래프 5색 규칙과 맞춘 팔레트, 판정명 고정)
JUDGEMENT_COLORS = {
    "수동 차단": "#ef4444",
    "AI 차단": "#f97316",
    "블랙 의심": "#c2410c",
    "화이트 의심": "#f59e0b",
    "수동 허용": "#38bdf8",
    "AI 안전": "#10b981",
}


@api_view(["GET"])
def get_online_users(request):
    try:
        return Response(
            [
                {
                    "id": idx,
                    "emp_name": log.employee.name if log.employee else "알 수 없음",
                    "emp_id": log.employee.employee_id if log.employee else "-",
                    "ip": employee_ip(log.online_ip),
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
                    )
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
                        "ip": employee_ip(log.online_ip),
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


def _monitoring_status():
    last_log = WebAccessLog.objects.aggregate(m=Max("access_time"))["m"]
    return {
        "last_log_time": last_log.strftime("%Y-%m-%d %H:%M") if last_log else None,
        "minutes_since_log": int((timezone.now() - last_log).total_seconds() // 60)
        if last_log
        else None,
        "watcher_alive": is_watcher_alive(),
    }


@api_view(["GET"])
def get_traffic_stats(request):
    try:
        interval_min = int(request.GET.get("interval", 60))
        # 조회 기간(일). 기본 3일 유지, 최근 7일/30일 등으로 확장 가능
        range_days = max(1, int(request.GET.get("days", 3)))
        range_hours = range_days * 24
        now = timezone.now()
        t_func, delta, total_pts = (
            (
                TruncMinute("access_time"),
                timedelta(minutes=interval_min),
                range_hours * (60 // interval_min) + 1,
            )
            if interval_min < 60
            else (TruncHour("access_time"), timedelta(hours=1), range_hours + 1)
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
        
        # 그래프는 로그 분석실과 같이 접속 시점의 판정으로 집계한다
        def _count_by_time(category):
            return (
                base_qs.filter(access_category_q(category))
                .annotate(time_bucket=t_func)
                .values("time_bucket")
                .annotate(c=Count("web_access_log_id"))
            )

        n_qs = _count_by_time("정상")
        b_qs = _count_by_time("차단")
        ai_qs = _count_by_time("의심")

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

        # 다른 그래프와 같은 조회 기간 기준으로 집계한다
        top_qs = (
            base_qs.filter(access_category_q("차단"))
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

        ai_suspicious_list = []
        for b in BlacklistAddr.objects.filter(
            deleted_at__isnull=True, source__in=["AI", "DOUBT"]
        ).order_by("-blacklist_id"):
            if b.source == "DOUBT":
                st, col, bg = "블랙 의심", "#c2410c", "rgba(194, 65, 12, 0.1)"
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
            deleted_at__isnull=True, source="DOUBT"
        ).order_by("-whitelist_id"):
            ai_suspicious_list.append(
                {
                    "domain": w.whitelist_domain,
                    "status_text": "화이트 의심",
                    "color": "#f59e0b",
                    "bgColor": "rgba(245, 158, 11, 0.1)",
                }
            )

        # 판정 구성비: 모든 접속을 판정 주체로 나눠 겹치지 않게 보여준다.
        # 수동 판정(수동 허용/수동 차단)과 AI 판정(안전/화이트 의심/블랙 의심/차단)의 합이 전체 접속 건수다.
        # 판정 코드가 없는 기록은 로그 분석실과 같이 access_flag로 수동 허용·차단으로 센다(judge_access).
        judgement_counts = {}
        for row in base_qs.values("ai_status_code", "access_flag").annotate(
            c=Count("web_access_log_id")
        ):
            name, _ = judge_access(row["ai_status_code"], row["access_flag"])
            judgement_counts[name] = judgement_counts.get(name, 0) + row["c"]

        def _breakdown(names):
            return [
                {
                    "name": name,
                    "value": judgement_counts[name],
                    "color": JUDGEMENT_COLORS[name],
                }
                for name in names
                if judgement_counts.get(name, 0) > 0
            ]

        policy_breakdown_manual = _breakdown(("수동 허용", "수동 차단"))
        policy_breakdown_ai = _breakdown(
            ("AI 안전", "화이트 의심", "블랙 의심", "AI 차단")
        )

        return Response(
            {
                "status": "success",
                "data": chart_data,
                "top_domains": top_domains,
                "top_ai_suspicious": ai_suspicious_list,
                "policy_breakdown_manual": policy_breakdown_manual,
                "policy_breakdown_ai": policy_breakdown_ai,
                "monitoring": _monitoring_status(),
            }
        )
    except Exception as e:
        logger.error(f"대시보드 통계 조회 오류: {e}")
        return Response({"status": "error", "message": SERVER_ERROR_MESSAGE}, status=500)


@api_view(["GET", "POST"])
@audited("인증 정책 설정", "work_start_time", "work_end_time", "waiting_time")
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
                requests.post(f"{PCAP_BACKEND_URL}/api/sync_policy", timeout=2)
            except requests.RequestException as e:
                logger.warning("설비 구동 시간 전달 실패: %s", e)
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
        logger.error("설비 구동 시간 처리 오류: %s", e)
        return Response({"status": "error", "message": SERVER_ERROR_MESSAGE}, status=500)


def _send_to_pcap_for_ai(path, payload):
    """DB에 저장한 값을 PCAP 백엔드(8080)로 보내서 AI 서버까지 경유 전달하게 한다."""
    try:
        # PCAP_BACKEND_URL (예: http://127.0.0.1:8080) 로 요청을 보냅니다.
        return requests.post(f"{PCAP_BACKEND_URL}{path}", json=payload, timeout=2).ok
    except requests.RequestException as e:
        logger.warning("PCAP 백엔드 경유 AI 서버 전송 실패 (%s): %s", path, e)
        return False


def _with_delivery(message, delivered):
    return message if delivered else f"{message} 다만 동기화 서버(PCAP)로 전달하지 못했습니다."


@api_view(["GET", "POST"])
@audited("AI 판별 기준 변경", "config_id", "white_start", "black_start", "block_start", actor_key="employee_id")
def manage_ai_thresholds(request):
    try:
        if request.method == "GET":
            return Response({"status": "success", "levels": get_threshold_levels()})

        is_valid, error_msg = verify_admin_auth(
            request, request.data.get("employee_id"), request.data.get("password")
        )
        if not is_valid:
            return Response({"status": "error", "message": error_msg}, status=403)

        try:
            config_id = int(request.data.get("config_id"))
            white_start = int(request.data.get("white_start"))
            black_start = int(request.data.get("black_start"))
            block_start = int(request.data.get("block_start"))
        except (TypeError, ValueError):
            return Response({"status": "error", "message": "레벨과 기준 점수는 숫자로 입력해 주세요."}, status=400)
        if not 0 < white_start < black_start < block_start <= 100:
            return Response(
                {"status": "error", "message": "화이트 의심 < 블랙 의심 < 차단 순서로, 1~100 사이에서 입력해 주세요."},
                status=400,
            )

        # 레벨(config_id)은 엄격→완화 순서이므로, 차단 점수도 그 순서를 지켜야 레벨 구분이 의미가 있다
        other_ids = sorted(
            AiThresholdConfig.objects.exclude(pk=config_id).values_list("pk", flat=True)
        )
        all_ids = sorted(other_ids + [config_id])
        idx = all_ids.index(config_id)
        if idx > 0:
            prev = AiThresholdConfig.objects.get(pk=all_ids[idx - 1])
            if block_start <= prev.black_limit:
                return Response(
                    {"status": "error", "message": f"차단 점수가 더 엄격한 레벨({prev.black_limit}점)과 겹칩니다. 더 높은 값을 입력해 주세요."},
                    status=400,
                )
        if idx < len(all_ids) - 1:
            nxt = AiThresholdConfig.objects.get(pk=all_ids[idx + 1])
            if block_start >= nxt.black_limit:
                return Response(
                    {"status": "error", "message": f"차단 점수가 더 완화된 레벨({nxt.black_limit}점)과 겹칩니다. 더 낮은 값을 입력해 주세요."},
                    status=400,
                )

        updated = AiThresholdConfig.objects.filter(pk=config_id).update(
            white_doubt_limit=white_start,
            black_doubt_limit=black_start,
            black_limit=block_start,
            updated_at=timezone.now(),
        )
        if not updated:
            return Response({"status": "error", "message": "해당 레벨을 찾을 수 없습니다."}, status=404)

        delivered = _send_to_pcap_for_ai(
            "/api/update_ai_threshold",
            {
                "white_doubt_limit": white_start,
                "black_doubt_limit": black_start,
                "black_limit": block_start,
            },
        )
        return Response(
            {
                "status": "success",
                "ai_server_delivered": delivered,
                "message": _with_delivery("판별 기준을 저장했습니다.", delivered),
                "levels": get_threshold_levels(),
            }
        )
    except Exception as e:
        logger.error("AI 판별 기준 처리 오류: %s", e)
        return Response({"status": "error", "message": SERVER_ERROR_MESSAGE}, status=500)


@api_view(["POST"])
@audited("AI 모델 가동 전환", "version_name", actor_key="employee_id")
def activate_ai_model(request):
    try:
        is_valid, error_msg = verify_admin_auth(
            request, request.data.get("employee_id"), request.data.get("password")
        )
        if not is_valid:
            return Response({"status": "error", "message": error_msg}, status=403)

        version_name = request.data.get("version_name")
        if not version_name:
            return Response({"status": "error", "message": "버전 이름이 필요합니다."}, status=400)
        target_model = AiModelMetrics.objects.filter(version_name=version_name).first()
        if not target_model:
            return Response({"status": "error", "message": "해당 모델 버전을 찾을 수 없습니다."}, status=404)

        with transaction.atomic():
            AiModelMetrics.objects.update(is_active=False)
            AiModelMetrics.objects.filter(pk=target_model.pk).update(is_active=True)

        delivered = _send_to_pcap_for_ai(
            "/api/update_ai_model", {"model_version": target_model.version_name}
        )
        return Response(
            {
                "status": "success",
                "ai_server_delivered": delivered,
                "message": _with_delivery(f"모델 [{version_name}]을(를) 가동 상태로 바꿨습니다.", delivered),
            }
        )
    except Exception as e:
        logger.error("AI 모델 가동 전환 오류: %s", e)
        return Response({"status": "error", "message": SERVER_ERROR_MESSAGE}, status=500)