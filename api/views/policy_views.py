import hashlib
import re

from django.contrib.auth.hashers import check_password
from django.db import transaction
from django.db.models import Count, Max, OuterRef, Subquery
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from api.models import (
    AiModelMetrics,
    BlacklistAddr,
    Employees,
    WebAccessLog,
    WhitelistAddr,
)

from .audit import audited
from .utils import (
    SERVER_ERROR_MESSAGE,
    get_client_ip,
    is_admin_ip_allowed,
    logger,
    notify_pcap_delta,
    sync_pcap_json_files,
)


def sanitize_domain(raw_domain):
    return (
        re.sub(r"^(https?://)?(www\.)?", "", str(raw_domain).strip().lower())
        .split("/")[0]
        .split(":")[0]
    )


def verify_admin_auth(request, emp_id, emp_pw):
    if not is_admin_ip_allowed(get_client_ip(request)):
        return False, "접근 거부: 인가된 PC가 아닙니다."
    emp = Employees.objects.filter(
        employee_id=emp_id, is_manager=True, deleted_at__isnull=True
    ).first()
    if not emp:
        return (
            False,
            "관리자 계정을 찾을 수 없거나 권한(is_manager)이 부여되지 않았습니다.",
        )
    if (
        emp.password == emp_pw
        or check_password(emp_pw, emp.password)
        or emp.password == hashlib.sha256(emp_pw.encode("utf-8")).hexdigest()
    ):
        return True, "인증 성공"
    return False, "비밀번호가 일치하지 않습니다."


def _domain_access_stats(domains):
    """도메인별 접속 수와 최근 접속 시간을 돌려준다."""
    rows = (
        WebAccessLog.objects.filter(target_url__in=domains)
        .values("target_url")
        .annotate(count=Count("pk"), last=Max("access_time"))
    )
    return {
        r["target_url"]: {
            "access_count": r["count"],
            "last_access": r["last"].strftime("%Y-%m-%d %H:%M") if r["last"] else None,
        }
        for r in rows
    }


NO_ACCESS_STATS = {"access_count": 0, "last_access": None}


@api_view(["GET"])
def get_blocklist(request):
    results = []
    policies = list(BlacklistAddr.objects.filter(deleted_at__isnull=True, source="USER"))
    stats = _domain_access_stats([p.blacklist_domain for p in policies])
    for p in policies:
        results.append(
            {
                "blacklist_domain": p.blacklist_domain,
                "source": "USER",
                **stats.get(p.blacklist_domain, NO_ACCESS_STATS),
            }
        )
    return Response(results)


@api_view(["POST"])
@audited("차단 정책 등록", "blacklist_domain", "no_access_domain")
def add_policy(request):
    domain = sanitize_domain(
        request.data.get("blacklist_domain") or request.data.get("no_access_domain", "")
    )
    if not domain:
        return Response({"error": "차단할 도메인 주소를 입력해주세요."}, status=400)

    # 화이트리스트에 이미 존재하는지 엄격히 검사
    if WhitelistAddr.objects.filter(
        whitelist_domain=domain, deleted_at__isnull=True
    ).exists():
        return Response(
            {
                "error": f"'{domain}'은(는) 현재 허용(White) 정책에 등록되어 있습니다. 먼저 허용을 해제해주세요."
            },
            status=400,
        )

    p = BlacklistAddr.objects.filter(blacklist_domain=domain).first()
    if p:
        if p.deleted_at is None and p.source == "USER":
            return Response({"error": "이미 활성화된 차단 도메인입니다."}, status=400)
        
        # 이미 존재한다면 (AI 등록 or 과거 삭제건), USER 소스로 변경하고 부활시킴 (중복 insert 방지)
        p.deleted_at = None
        p.source = "USER"
        p.save()
    else:
        # DB에 아예 없던 도메인일 경우에만 새로 생성
        BlacklistAddr.objects.create(blacklist_domain=domain, source="USER")

    notify_pcap_delta("black", "add", domain)
    return Response(
        {"status": "success", "message": f"'{domain}' 차단 정책 등록 완료"}, status=201
    )


@api_view(["POST"])
@audited("차단 정책 해제", "blacklist_domain", "no_access_domain")
def delete_policy(request):
    domain = sanitize_domain(
        request.data.get("no_access_domain") or request.data.get("blacklist_domain", "")
    )
    try:
        p = BlacklistAddr.objects.get(
            blacklist_domain=domain, deleted_at__isnull=True, source="USER"
        )
        p.deleted_at = timezone.now().date()
        p.save()
        notify_pcap_delta("black", "delete", domain)
        return Response({"status": "success"})
    except BlacklistAddr.DoesNotExist:
        return Response(
            {"status": "error", "message": "정책을 찾을 수 없습니다."}, status=404
        )


@api_view(["GET"])
def get_whitelist(request):
    res = []
    policies = list(
        WhitelistAddr.objects.filter(deleted_at__isnull=True, source="USER").order_by(
            "-is_protected", "whitelist_domain"
        )
    )
    stats = _domain_access_stats([w.whitelist_domain for w in policies])
    for w in policies:
        res.append(
            {
                "domain": w.whitelist_domain,
                "description": "시스템 기본 보호 도메인"
                if w.is_protected
                else "일반 허용 도메인 (사용자)",
                "is_protected": w.is_protected,
                **stats.get(w.whitelist_domain, NO_ACCESS_STATS),
            }
        )
    return Response(res)


@api_view(["POST"])
@audited("허용 정책 등록", "domain")
def add_whitelist(request):
    domain = sanitize_domain(request.data.get("domain", ""))
    if not domain:
        return Response({"error": "도메인을 입력해주세요."}, status=400)

    # 블랙리스트에 이미 존재하는지 엄격히 검사
    if BlacklistAddr.objects.filter(
        blacklist_domain=domain, deleted_at__isnull=True
    ).exists():
        return Response(
            {
                "error": f"'{domain}'은(는) 현재 차단(Black) 정책에 등록되어 있습니다. 먼저 차단을 해제해주세요."
            },
            status=400,
        )

    obj = WhitelistAddr.objects.filter(whitelist_domain=domain).first()
    
    if obj:
        if obj.deleted_at is None and obj.source == "USER":
            return Response({"error": "이미 활성화된 허용 도메인입니다."}, status=400)
        
        # AI가 넣었든 삭제되었든, 소스를 USER로 덮어쓰고 상태 업데이트
        obj.deleted_at = None
        obj.source = "USER"
        obj.is_protected = False
        obj.save()
    else:
        # 완전 새로운 도메인만 새로 insert
        WhitelistAddr.objects.create(whitelist_domain=domain, source="USER", is_protected=False)

    notify_pcap_delta("white", "add", domain)
    return Response({"status": "success"})


@api_view(["POST"])
@audited("허용 정책 해제", "domain")
def delete_whitelist(request):
    domain = sanitize_domain(request.data.get("domain", ""))
    try:
        w_obj = WhitelistAddr.objects.filter(
            whitelist_domain=domain, deleted_at__isnull=True, source="USER"
        ).first()
        if not w_obj:
            raise WhitelistAddr.DoesNotExist

        if w_obj.is_protected:
            # 문구 유지
            return Response(
                {"error": "시스템 보호 도메인은 관리자 권한으로 강제 해제해야 합니다."},
                status=403,
            )
        w_obj.deleted_at = timezone.now().date()
        w_obj.save()
        
        notify_pcap_delta("white", "delete", domain)
        return Response({"status": "success"})
    
    except WhitelistAddr.DoesNotExist:
        return Response({"error": "도메인을 찾을 수 없습니다."}, status=404)


@api_view(["POST"])
@audited("보호 도메인 지정", "domain", actor_key="employee_id")
def upgrade_whitelist(request):
    domain = sanitize_domain(request.data.get("domain", ""))
    emp_id, emp_pw = request.data.get("employee_id"), request.data.get("password")
    is_valid, error_msg = verify_admin_auth(request, emp_id, emp_pw)
    if not is_valid:
        return Response({"error": error_msg}, status=403)
    WhitelistAddr.objects.filter(
        whitelist_domain=domain, deleted_at__isnull=True, source="USER"
    ).update(is_protected=True)
    return Response({"status": "success", "message": "보호 도메인으로 격상되었습니다."})


@api_view(["POST"])
@audited("보호 도메인 해제", "domain", actor_key="employee_id")
def force_delete_whitelist(request):
    domain = sanitize_domain(request.data.get("domain", ""))
    emp_id, emp_pw = request.data.get("employee_id"), request.data.get("password")
    is_valid, error_msg = verify_admin_auth(request, emp_id, emp_pw)
    if not is_valid:
        return Response({"error": error_msg}, status=403)
    WhitelistAddr.objects.filter(
        whitelist_domain=domain, deleted_at__isnull=True, source="USER"
    ).update(is_protected=False)
    sync_pcap_json_files("white")
    return Response(
        {
            "status": "success",
            "message": "기본 보호가 해제되어 일반 도메인으로 격하되었습니다.",
        }
    )


def _activate_as_user(model, domain_field, domain):
    """도메인을 정식(USER) 정책으로 만든다. 같은 도메인의 다른 활성 행은 삭제 처리해 중복을 막는다."""
    rows = list(model.objects.filter(**{domain_field: domain}).order_by("pk"))
    if not rows:
        model.objects.create(**{domain_field: domain, "source": "USER"})
        return

    keep = next(
        (r for r in rows if r.deleted_at is None and r.source == "USER"), rows[0]
    )
    keep.source = "USER"
    keep.deleted_at = None
    keep.save()
    model.objects.filter(
        **{domain_field: domain}, deleted_at__isnull=True
    ).exclude(pk=keep.pk).update(deleted_at=timezone.now().date())


@api_view(["POST"])
@audited("AI 정책 이관", "action", "domains", "domain", actor_key="employee_id")
def promote_ai_policy(request):
    action = request.data.get("action")
    domains = request.data.get("domains", [])
    emp_id = request.data.get("employee_id")
    emp_pw = request.data.get("password")

    if "domain" in request.data and not domains:
        domains = [request.data.get("domain")]

    if not domains or not action:
        return Response({"error": "도메인 목록과 액션(명령)이 필요합니다."}, status=400)

    is_valid, error_msg = verify_admin_auth(request, emp_id, emp_pw)
    if not is_valid:
        return Response({"error": error_msg}, status=403)

    today = timezone.now().date()
    released = 0
    try:
        with transaction.atomic():
            for raw_domain in domains:
                domain = sanitize_domain(raw_domain)
                if not domain:
                    continue

                if action == "to_user_white":
                    BlacklistAddr.objects.filter(
                        blacklist_domain=domain, deleted_at__isnull=True
                    ).update(deleted_at=today)
                    _activate_as_user(WhitelistAddr, "whitelist_domain", domain)

                elif action == "to_user_black":
                    if WhitelistAddr.objects.filter(
                        whitelist_domain=domain,
                        deleted_at__isnull=True,
                        is_protected=True,
                    ).exists():
                        raise ValueError(
                            f"'{domain}'은(는) 시스템 보호 도메인이라 차단으로 이관할 수 없습니다."
                        )
                    WhitelistAddr.objects.filter(
                        whitelist_domain=domain, deleted_at__isnull=True
                    ).update(deleted_at=today)
                    _activate_as_user(BlacklistAddr, "blacklist_domain", domain)

                elif action == "release":
                    # AI 안전/위험으로 확정된 자동 등록 건만 해제 (의심·수동 정책은 대상 아님)
                    released += WhitelistAddr.objects.filter(
                        whitelist_domain=domain, deleted_at__isnull=True, source="AI"
                    ).update(deleted_at=today)
                    released += BlacklistAddr.objects.filter(
                        blacklist_domain=domain, deleted_at__isnull=True, source="AI"
                    ).update(deleted_at=today)

                else:
                    raise ValueError("잘못된 이관 명령입니다.")

            if action == "release" and released == 0:
                raise ValueError("해제할 수 있는 AI 판별 도메인이 없습니다.")

        # 허용·차단 목록이 함께 바뀌므로 엔진에는 양쪽 모두 동기화
        sync_pcap_json_files("all")
        message = (
            f"{released}건의 AI 정책이 해제되었습니다."
            if action == "release"
            else f"{len(domains)}건의 정책 이관이 완료되었습니다."
        )
        return Response({"status": "success", "message": message})
    except ValueError as e:
        return Response({"error": str(e)}, status=400)
    except Exception as e:
        logger.error("AI 정책 처리 실패: %s", e)
        return Response({"error": SERVER_ERROR_MESSAGE}, status=500)


def _latest_ai_score(domain_field):
    """도메인의 가장 최근 AI 점수. 점수 없는 기록(-1)은 제외한다."""
    return Subquery(
        WebAccessLog.objects.filter(
            target_url=OuterRef(domain_field), ai_score__gte=0
        )
        .order_by("-access_time")
        .values("ai_score")[:1]
    )


@api_view(["GET"])
def get_ai_policies(request):
    try:
        data = []
        for w in WhitelistAddr.objects.filter(
            deleted_at__isnull=True, source__in=["AI", "DOUBT"]
        ).annotate(ai_score=_latest_ai_score("whitelist_domain")):
            time_val = getattr(w, "insert_time", getattr(w, "created_at", None))
            time_str = time_val.strftime("%Y-%m-%d %H:%M:%S") if time_val else "-"
            data.append({
                "domain": w.whitelist_domain,
                "ai_status": w.source,
                "ai_score": w.ai_score,
                "source": "white",
                "detect_time": time_str
            })

        for b in BlacklistAddr.objects.filter(
            deleted_at__isnull=True, source__in=["AI", "DOUBT"]
        ).annotate(ai_score=_latest_ai_score("blacklist_domain")):
            time_val = getattr(b, "insert_time", getattr(b, "created_at", None))
            time_str = time_val.strftime("%Y-%m-%d %H:%M:%S") if time_val else "-"
            data.append({
                "domain": b.blacklist_domain,
                "ai_status": b.source,
                "ai_score": b.ai_score,
                "source": "black",
                "detect_time": time_str
            })

        # 최신순 정렬
        data.sort(key=lambda x: x["detect_time"], reverse=True)
        return Response({"status": "success", "ai_data": data})
    except Exception as e:
        logger.error("AI 정책 처리 실패: %s", e)
        return Response({"error": SERVER_ERROR_MESSAGE}, status=500)


@api_view(["GET"])
def get_ai_model_metrics(request):
    """AI_model_metrics 조회 전용 API. 학습 순서대로 내려준다."""
    try:
        metrics = []
        for m in AiModelMetrics.objects.order_by("trained_at", "pk"):
            metrics.append(
                {
                    "version_name": m.version_name,
                    "model_algorithm": m.model_algorithm,
                    "trained_at": m.trained_at.strftime("%Y-%m-%d %H:%M:%S"),
                    "hyperparameters": m.hyperparameters,
                    "tp_count": m.tp_count,
                    "tn_count": m.tn_count,
                    "fp_count": m.fp_count,
                    "fn_count": m.fn_count,
                    "accuracy": m.accuracy,
                    "precision": m.precision,
                    "f1_score": m.f1_score,
                    "is_active": m.is_active,
                }
            )
        return Response({"status": "success", "metrics": metrics})
    except Exception as e:
        logger.error("AI 정책 처리 실패: %s", e)
        return Response({"error": SERVER_ERROR_MESSAGE}, status=500)
