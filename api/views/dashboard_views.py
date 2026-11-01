import datetime
from datetime import timedelta

import requests
from django.db.models import Count, Max, Q
from django.db.models.functions import TruncHour, TruncMinute
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import (
    BlacklistAddr,
    EqpRunTime,
    OnlineListLog,
    WebAccessLog,
    WhitelistAddr,
)
from .audit import audited
from .policy_history import is_watcher_alive
from .utils import SERVER_ERROR_MESSAGE, get_policy_domain_sets, logger


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


def _monitoring_status():
    """관제가 살아 있는지 판단할 수 있도록 마지막 로그 시각과 감시 프로그램 상태를 돌려준다."""
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
        # 차트 기준: 등록된 도메인의 접속 수를 정책 종류별로 집계
        #    정상 통과 = 허용(수동) + AI 안전 / 위협 차단 = 차단(수동) + AI 위험 / AI 의심 통과 = 화이트 의심 + 블랙 의심
        allowed_domains = WhitelistAddr.objects.filter(
            deleted_at__isnull=True, source__in=["USER", "AI"]
        ).values_list("whitelist_domain", flat=True)
        blocked_domains, suspect_domains = get_policy_domain_sets()

        n_qs = (
            base_qs.filter(access_flag="정상", target_url__in=list(allowed_domains))
            .annotate(time_bucket=t_func)
            .values("time_bucket")
            .annotate(c=Count("web_access_log_id"))
        )
        b_qs = (
            base_qs.filter(Q(access_flag="차단") | Q(target_url__in=blocked_domains))
            .annotate(time_bucket=t_func)
            .values("time_bucket")
            .annotate(c=Count("web_access_log_id"))
        )

        ai_qs = (
            base_qs.filter(access_flag="정상", target_url__in=suspect_domains)
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

        # 우측 상단: 정식 위협 차단 누적 트래픽 도메인 Top 5
        top_qs = (
            WebAccessLog.objects.filter(
                Q(access_flag="차단") | Q(target_url__in=blocked_domains)
            )
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

        # 우측 하단: AI 탐지 기반 대기열 (위험/의심) - 정책 테이블에서 직접 로드
        ai_suspicious_list = []
        for b in BlacklistAddr.objects.filter(
            deleted_at__isnull=True, source__in=["AI", "DOUBT"]
        ).order_by("-blacklist_id"):
            if b.source == "DOUBT":
                st, col, bg = "블랙 의심", "#f97316", "rgba(249, 115, 22, 0.1)"
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
                    "color": "#eab308",
                    "bgColor": "rgba(234, 179, 8, 0.1)",
                }
            )

        return Response(
            {
                "status": "success",
                "data": chart_data,
                "top_domains": top_domains,
                "top_ai_suspicious": ai_suspicious_list,
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
        return Response({"status": "error", "message": SERVER_ERROR_MESSAGE}, status=500)
