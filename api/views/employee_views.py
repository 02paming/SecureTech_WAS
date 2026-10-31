from django.core.cache import cache
from django.db.models import Avg
from django.db import IntegrityError
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

# 💡 [수정] BlacklistAddrAccessLog 제거, WebAccessLog 사용
from ..models import (
    Employees,
    OnlineIpMacMismatchLog,
    OnlineList,
    OnlineListLog,
    ProspectiveMembers,
    WebAccessLog,
)
from .ai_services import generate_advisor_message
from .utils import (
    DUPLICATE_MEMBER_MESSAGE,
    SERVER_ERROR_MESSAGE,
    block_emp,
    is_emp_blocked,
    unblock_emp,
    format_jumin_and_birth,
    logger,
    sync_expire_to_pcap,
    sync_pcap_json_files,
)


@api_view(["GET"])
def get_pending_members(request):
    return Response(
        [
            {
                "member_id": p.member_id,
                "name": p.name,
                "email": p.email,
                "phone_number": p.phone_number,
                "address": p.address,
                "birth_date": format_jumin_and_birth(getattr(p, "jumin_no", ""))[0],
                "created_at": p.date_of_request.strftime("%Y-%m-%d")
                if getattr(p, "date_of_request", None)
                else "-",
            }
            for p in ProspectiveMembers.objects.all().order_by("-date_of_request")
        ]
    )


@api_view(["POST"])
def approve_member(request):
    try:
        candidate = ProspectiveMembers.objects.get(
            member_id=request.data.get("member_id")
        )
        last_emp = Employees.objects.order_by("-employee_number").first()
        Employees.objects.create(
            employee_number=(
                (last_emp.employee_number + 1)
                if (last_emp and last_emp.employee_number)
                else 1
            ),
            employee_id=candidate.member_id,
            password=candidate.password,
            name=candidate.name,
            email=candidate.email,
            address=candidate.address,
            phone_number=candidate.phone_number,
            jumin_no=candidate.jumin_no,
            hire_date=timezone.now().date(),
            is_manager=0,
        )
        candidate.delete()
        cache.delete("employee_list_data")
        return Response({"status": "success", "message": "가입이 승인되었습니다."})
    except ProspectiveMembers.DoesNotExist:
        return Response(
            {"error": "대기자를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND
        )
    except IntegrityError:
        return Response(
            {"error": DUPLICATE_MEMBER_MESSAGE}, status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error("가입 승인 실패: %s", e)
        return Response(
            {"error": SERVER_ERROR_MESSAGE}, status=status.HTTP_400_BAD_REQUEST
        )


@api_view(["POST"])
def reject_member(request):
    try:
        ProspectiveMembers.objects.get(member_id=request.data.get("member_id")).delete()
        return Response({"status": "success", "message": "가입 신청이 거절되었습니다."})
    except ProspectiveMembers.DoesNotExist:
        return Response(
            {"error": "대기자를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error("가입 반려 실패: %s", e)
        return Response(
            {"error": SERVER_ERROR_MESSAGE}, status=status.HTTP_400_BAD_REQUEST
        )


@api_view(["GET"])
def get_employees(request):
    cached_data = cache.get("employee_list_data")
    if cached_data:
        return Response(cached_data)
    data = []
    for emp in Employees.objects.all():
        current_ym = emp.hire_date.strftime("%Y%m") if emp.hire_date else "202610"
        birth_date, masked_jumin = format_jumin_and_birth(getattr(emp, "jumin_no", ""))
        data.append(
            {
                "employee_id": emp.employee_id,
                "employee_number": emp.employee_number,
                "emp_code": f"ST{current_ym}{emp.employee_number:02d}"
                if emp.employee_number
                else "-",
                "hire_date": emp.hire_date.strftime("%Y-%m-%d")
                if emp.hire_date
                else "-",
                "name": emp.name,
                "phone_number": emp.phone_number,
                "email": emp.email,
                "jumin_no": masked_jumin,
                "birth_date": birth_date,
                "address": emp.address,
                "is_manager": bool(emp.is_manager),
                "is_deleted": bool(emp.deleted_at),
            }
        )
    cache.set("employee_list_data", data, timeout=60)
    return Response(data)


@api_view(["POST"])
def update_employee(request):
    try:
        employee = Employees.objects.get(employee_id=request.data.get("employee_id"))
        employee.phone_number = request.data.get("phone_number", employee.phone_number)
        employee.address = request.data.get("address", employee.address)
        employee.email = request.data.get("email", employee.email)
        employee.save()
        cache.delete("employee_list_data")
        return Response({"status": "success", "message": "수정 성공"})
    except Employees.DoesNotExist:
        return Response(
            {"status": "error", "message": "사원 없음"},
            status=status.HTTP_404_NOT_FOUND,
        )


@api_view(["POST"])
def delete_employee(request):
    try:
        employee = Employees.objects.get(employee_id=request.data.get("employee_id"))
        employee.deleted_at = timezone.now().date()
        employee.save()
        OnlineList.objects.filter(employee=employee).delete()
        sync_pcap_json_files("all")
        cache.delete("employee_list_data")
        return Response(
            {"status": "success", "message": "비활성화(퇴사) 처리되었습니다."}
        )
    except Employees.DoesNotExist:
        return Response(
            {"status": "error", "message": "사원 없음"},
            status=status.HTTP_404_NOT_FOUND,
        )


@api_view(["POST"])
def hard_delete_employee(request):
    try:
        employee = Employees.objects.get(employee_id=request.data.get("employee_id"))
        log_ids = list(
            OnlineListLog.objects.filter(employee=employee).values_list(
                "online_list_log_id", flat=True
            )
        )
        if log_ids:
            # 💡 [수정] WebAccessLog 하나만 삭제(정상, 차단 모두 포함)
            WebAccessLog.objects.filter(online_list_log_id__in=log_ids).delete()
            OnlineIpMacMismatchLog.objects.filter(
                online_list_log_id__in=log_ids
            ).delete()

        OnlineList.objects.filter(employee=employee).delete()
        OnlineListLog.objects.filter(employee=employee).delete()
        employee.delete()
        cache.delete("employee_list_data")
        return Response(
            {"status": "success", "message": "사원 데이터가 완전히 파기되었습니다."}
        )
    except Employees.DoesNotExist:
        return Response(
            {"status": "error", "message": "사원 없음"},
            status=status.HTTP_404_NOT_FOUND,
        )


@api_view(["GET"])
def get_employee_auth_status(request):
    try:
        active_sessions = OnlineList.objects.select_related("employee").order_by(
            "-login_time"
        )
        response_data, seen_emps = [], set()
        for session in active_sessions:
            emp = session.employee
            if not emp or emp.deleted_at or emp.employee_id in seen_emps:
                continue
            seen_emps.add(emp.employee_id)
            is_blocked = is_emp_blocked(emp.employee_id)
            current_ym = (
                emp.hire_date.strftime("%Y%m")
                if getattr(emp, "hire_date", None)
                else timezone.now().strftime("%Y%m")
            )
            response_data.append(
                {
                    "id": len(response_data) + 1,
                    "emp_no": f"ST{current_ym}{emp.employee_number:02d}"
                    if getattr(emp, "employee_number", None)
                    else "-",
                    "emp_name": emp.name,
                    "emp_id": emp.employee_id,
                    "ip": f"192.168.2.{session.online_ip}"
                    if session.online_ip
                    else "-",
                    "mac": getattr(session, "online_mac_addr", None) or "-",
                    "login_status": "차단됨" if is_blocked else "접속 중",
                    "is_active": not is_blocked,
                    "is_blocked": is_blocked,
                    "external_status": "차단됨" if is_blocked else "인증 완료",
                    "login_time": session.login_time.strftime("%Y-%m-%d %H:%M:%S")
                    if (session.login_time and hasattr(session.login_time, "strftime"))
                    else str(session.login_time or "-"),
                    "logout_time": "-",
                }
            )
        return Response(response_data)
    except Exception as e:
        logger.error("사원 인증 현황 조회 실패: %s", e)
        return Response([])


@api_view(["GET"])
def get_employee_security_detail(request, emp_id):
    try:
        clean_key = str(emp_id).strip()
        employee = Employees.objects.filter(employee_id=clean_key).first()
        if not employee and clean_key.isdigit():
            employee = Employees.objects.filter(employee_number=int(clean_key)).first()
        if not employee:
            return Response(
                {"status": "error", "message": "사원을 찾을 수 없습니다."}, status=404
            )

        online_session = OnlineList.objects.filter(employee=employee).first()
        current_ym = (
            employee.hire_date.strftime("%Y%m")
            if getattr(employee, "hire_date", None)
            else "202610"
        )
        birth_date, masked_jumin = format_jumin_and_birth(
            getattr(employee, "jumin_no", "")
        )

        online_logs_qs = OnlineListLog.objects.filter(employee=employee).order_by(
            "-login_time"
        )
        log_map, recent_logs = {}, []
        for log in online_logs_qs:
            ip_str = (
                f"192.168.2.{log.online_ip}"
                if getattr(log, "online_ip", None) is not None
                else "-"
            )
            mac_str = getattr(log, "online_mac_addr", None) or "-"
            time_str = (
                log.login_time.strftime("%Y-%m-%d %H:%M:%S")
                if getattr(log, "login_time", None)
                else "-"
            )
            log_map[log.online_list_log_id] = {
                "ip": ip_str,
                "mac": mac_str,
                "login_time": time_str,
            }
            recent_logs.append(
                {
                    "log_id": log.online_list_log_id,
                    "login_time": time_str,
                    "ip": ip_str,
                    "mac": mac_str,
                    "is_mismatch": False,
                    "mismatch_mac": None,
                }
            )

        log_ids = list(log_map.keys())
        mismatch_count, mismatch_map = 0, {}
        if log_ids:
            try:
                mismatch_qs = OnlineIpMacMismatchLog.objects.filter(
                    online_list_log_id__in=log_ids
                ).order_by("-insert_time")
                mismatch_count = mismatch_qs.count()
                for m in mismatch_qs:
                    mismatch_map[m.online_list_log_id] = getattr(
                        m, "mismatch_mac_addr", "-"
                    )
            except Exception:
                pass

        for item in recent_logs:
            if item["log_id"] in mismatch_map:
                item["is_mismatch"] = True
                item["mismatch_mac"] = mismatch_map[item["log_id"]]

        recent_violations, violation_count, normal_access_count = [], 0, 0
        if log_ids:
            try:
                # 💡 [수정] WebAccessLog에서 "차단" 이력만 추출
                v_base = WebAccessLog.objects.filter(
                    online_list_log_id__in=log_ids, access_flag="차단"
                )
                violation_count = v_base.count()
                v_qs = v_base.order_by("-access_time")[:1000]
                for v in v_qs:
                    domain_val = getattr(v, "target_url", "-") or "-"
                    v_time = (
                        v.access_time.strftime("%Y-%m-%d %H:%M:%S")
                        if getattr(v, "access_time", None)
                        else "-"
                    )
                    session_info = log_map.get(v.online_list_log_id, {})
                    recent_violations.append(
                        {
                            "ip": session_info.get(
                                "ip",
                                f"192.168.2.{online_session.online_ip}"
                                if online_session
                                else "-",
                            ),
                            "mac": session_info.get("mac", "-"),
                            "domain": domain_val,
                            "time": v_time,
                            "status": "차단",
                            "is_blocked": True,
                        }
                    )
            except Exception:
                pass

        web_access_list = []
        if log_ids:
            try:
                # 💡 [수정] WebAccessLog에서 "정상" 접근만 추출
                w_base = WebAccessLog.objects.filter(
                    online_list_log_id__in=log_ids, access_flag="정상"
                )
                normal_access_count = w_base.count()
                w_qs = w_base.order_by("-access_time")[:1000]
                for w in w_qs:
                    w_time = (
                        w.access_time.strftime("%Y-%m-%d %H:%M:%S")
                        if getattr(w, "access_time", None)
                        else "-"
                    )
                    session_info = log_map.get(w.online_list_log_id, {})
                    target_domain = getattr(w, "target_url", "-") or "알 수 없는 목적지"
                    web_access_list.append(
                        {
                            "ip": session_info.get(
                                "ip",
                                f"192.168.2.{online_session.online_ip}"
                                if online_session
                                else "-",
                            ),
                            "mac": session_info.get("mac", "-"),
                            "domain": target_domain,
                            "time": w_time,
                            "status": "허용",
                            "is_blocked": False,
                        }
                    )
            except Exception:
                pass

        external_access_logs = sorted(
            recent_violations + web_access_list,
            key=lambda x: x.get("time", ""),
            reverse=True,
        )
        security_score = max(
            0, 100 - (violation_count * 10) - (mismatch_count * 15)
        )
        current_mac = (
            online_session.online_mac_addr
            if (online_session and getattr(online_session, "online_mac_addr", None))
            else (recent_logs[0].get("mac", "-") if recent_logs else "-")
        )

        avg_ai_score = 0.0
        if log_ids:
            # 💡 [수정] 차단 내역에서 평균 AI 의심 스코어 계산
            score_agg = WebAccessLog.objects.filter(
                online_list_log_id__in=log_ids, access_flag="차단", ai_score__gt=0.0
            ).aggregate(Avg("ai_score"))
            avg_ai_score = score_agg.get("ai_score__avg") or 0.0

        advisor_message = generate_advisor_message(
            security_score, mismatch_count, violation_count, avg_ai_score
        )

        return Response(
            {
                "status": "success",
                "data": {
                    "emp_code": f"ST{current_ym}{employee.employee_number:02d}"
                    if getattr(employee, "employee_number", None)
                    else "-",
                    "employee_id": employee.employee_id,
                    "employee_number": employee.employee_number,
                    "name": employee.name,
                    "email": employee.email,
                    "phone_number": employee.phone_number,
                    "address": employee.address or "미입력",
                    "birth_date": birth_date,
                    "jumin_no": masked_jumin,
                    "hire_date": employee.hire_date.strftime("%Y-%m-%d")
                    if getattr(employee, "hire_date", None)
                    else "-",
                    "is_manager": bool(employee.is_manager),
                    "security_score": security_score,
                    "current_ip": f"192.168.2.{online_session.online_ip}"
                    if online_session
                    else "미접속 (오프라인)",
                    "current_mac": current_mac,
                    "login_time": online_session.login_time.strftime(
                        "%Y-%m-%d %H:%M:%S"
                    )
                    if (online_session and online_session.login_time)
                    else "-",
                    "violation_count": violation_count,
                    "normal_access_count": normal_access_count,
                    "mismatch_count": mismatch_count,
                    "recent_violations": recent_violations,
                    "recent_logs": recent_logs,
                    "external_access_logs": external_access_logs,
                    "security_advisor": advisor_message,
                },
            }
        )
    except Exception as e:
        logger.error("사원 상세 보안 조회 실패: %s", e)
        return Response(
            {"status": "error", "message": SERVER_ERROR_MESSAGE}, status=500
        )


@api_view(["POST"])
def block_employee(request):
    try:
        emp_id, kick_ip = (
            request.data.get("employee_id"),
            request.data.get("kick_host_id"),
        )
        if not emp_id:
            return Response({"error": "사원 ID 필수"}, status=400)
        block_emp(emp_id)
        OnlineList.objects.filter(employee__employee_id=emp_id).delete()
        sync_expire_to_pcap(emp_id, kick_ip)
        return Response(
            {"status": "success", "message": f"사원({emp_id}) 차단 및 킥 완료"}
        )
    except Exception as e:
        logger.error("사원 차단 처리 실패: %s", e)
        return Response({"error": SERVER_ERROR_MESSAGE}, status=500)


@api_view(["POST"])
def unblock_employee(request):
    try:
        emp_id = request.data.get("employee_id")
        if not emp_id:
            return Response({"error": "사원 ID 필수"}, status=400)
        unblock_emp(emp_id)
        sync_pcap_json_files("all")
        return Response({"status": "success", "message": "차단 해제 완료"})
    except Exception as e:
        logger.error("사원 차단 처리 실패: %s", e)
        return Response({"error": SERVER_ERROR_MESSAGE}, status=500)
