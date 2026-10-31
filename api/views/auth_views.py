import os
import re

import pyotp
from django.contrib.auth.hashers import check_password, make_password
from django.db import IntegrityError
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import Employees, OnlineList, ProspectiveMembers
from .utils import (
    DUPLICATE_MEMBER_MESSAGE,
    SERVER_ERROR_MESSAGE,
    RESTRICTED_IDS,
    extract_ip_suffix,
    format_jumin_and_birth,
    get_client_ip,
    logger,
    save_online_session,
    is_emp_blocked,
    sync_pcap_json_files_in_background,
)

DUPLICATE_CHECK_FIELDS = {"member_id", "email", "phone_number", "jumin_no"}


@api_view(["POST"])
def apply_signup(request):
    try:
        member_id = str(request.data.get("member_id", "")).strip().lower()
        if not member_id or member_id in RESTRICTED_IDS:
            return Response(
                {"error": f"'{member_id}'는 사용할 수 없는 아이디입니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ProspectiveMembers.objects.create(
            member_id=member_id,
            password=make_password(request.data.get("password")),
            name=str(request.data.get("name", "")).strip(),
            email=str(request.data.get("email", "")).strip(),
            address=str(request.data.get("address", "")).strip(),
            phone_number=re.sub(
                r"[^0-9]", "", str(request.data.get("phone_number", ""))
            )[:11],
            jumin_no=re.sub(r"[^0-9]", "", str(request.data.get("jumin_no", "")))[:13],
            date_of_request=timezone.now().date(),
        )
        return Response({"status": "success"}, status=status.HTTP_201_CREATED)
    except IntegrityError:
        return Response(
            {"error": DUPLICATE_MEMBER_MESSAGE}, status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error("가입 신청 실패: %s", e)
        return Response(
            {"error": SERVER_ERROR_MESSAGE}, status=status.HTTP_400_BAD_REQUEST
        )


@api_view(["POST"])
def check_duplicate(request):
    field, value = request.data.get("field"), str(request.data.get("value", "")).strip()
    # 정해진 항목만 조회한다. 그대로 쓰면 비밀번호 같은 컬럼도 조회 조건이 될 수 있다
    if field not in DUPLICATE_CHECK_FIELDS:
        return Response(
            {"error": "확인할 수 없는 항목입니다."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if field == "member_id" and value.lower() in RESTRICTED_IDS:
        return Response(
            {
                "is_duplicate": True,
                "message": f"'{value}'는 예약어로 사용할 수 없습니다.",
            }
        )

    if (
        ProspectiveMembers.objects.filter(**{field: value}).exists()
        or Employees.objects.filter(
            **{"employee_id" if field == "member_id" else field: value}
        ).exists()
    ):
        name_kr = {
            "member_id": "아이디",
            "email": "이메일",
            "phone_number": "전화번호",
            "jumin_no": "주민등록번호",
        }.get(field, field)
        return Response(
            {
                "is_duplicate": True,
                "message": f"이미 사용 중이거나 가입 대기 중인 {name_kr}입니다.",
            }
        )

    return Response({"is_duplicate": False})


@api_view(["POST"])
def login(request):
    emp_id = request.data.get("employee_id") or request.data.get("member_id")
    if is_emp_blocked(emp_id):
        return Response(
            {"status": "error", "message": "관리자에 의해 접근이 제한된 계정입니다."},
            status=status.HTTP_403_FORBIDDEN,
        )

    employee = Employees.objects.filter(
        employee_id=emp_id, deleted_at__isnull=True
    ).first()
    if employee and check_password(request.data.get("password"), employee.password):
        client_ip = get_client_ip(request)
        is_admin_login = request.data.get("is_admin_login", False)

        # 관리자 로그인 포털로 접속했는데 관리자가 아닌 경우 즉시 차단 (세션 생성 방지)
        if is_admin_login and not employee.is_manager:
            return Response(
                {"status": "error", "message": "관리자 권한이 없는 일반 계정입니다."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # [분기 1] 관리자일 경우 OTP 인증 프로세스 진행
        if employee.is_manager:
            if not (
                client_ip in {"127.0.0.1", "localhost", "::1", "192.168.3.50"}
                or client_ip.startswith(
                    (
                        os.getenv("ADMIN_ALLOWED_IP_PREFIX", "192.168.3."),
                        "100.",
                        "192.168.1.",
                    )
                )
            ):
                return Response(
                    {
                        "status": "error",
                        "message": "접근 거부: 관리자 전용 PC에서만 로그인 가능합니다.",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            current_secret = getattr(employee, "otp_secret", None)

            if not current_secret:
                new_secret = pyotp.random_base32()
                Employees.objects.filter(employee_id=employee.employee_id).update(
                    otp_secret=new_secret
                )

                totp = pyotp.TOTP(new_secret)
                otp_uri = totp.provisioning_uri(
                    name=employee.name, issuer_name="SecureTech"
                )

                return Response(
                    {
                        "status": "otp_setup_required",
                        "employee_id": employee.employee_id,
                        "otp_secret": new_secret,
                        "otp_uri": otp_uri,
                        "message": "구글 OTP 초기 설정이 필요합니다.",
                    }
                )

            return Response(
                {
                    "status": "otp_required",
                    "employee_id": employee.employee_id,
                    "message": "OTP 인증 번호를 입력해주세요.",
                }
            )

        # [분기 2] 일반 사원은 OTP 없이 즉시 로그인 완료
        # 웹 로그인은 네트워크 인증이 아니므로 online_list를 건드리지 않는다 (캡티브 포털에서만 기록)
        else:
            return Response(
                {
                    "status": "success",
                    "user": {
                        "emp_id": employee.employee_id,
                        "employee_id": employee.employee_id,
                        "name": employee.name,
                        "is_manager": employee.is_manager,
                        "online_ip": client_ip,
                    },
                }
            )

    return Response(
        {"status": "error", "message": "아이디 또는 비밀번호가 일치하지 않습니다."},
        status=status.HTTP_401_UNAUTHORIZED,
    )


@api_view(["POST"])
def verify_otp(request):
    emp_id = request.data.get("employee_id")
    otp_code = str(request.data.get("otp_code", "")).strip()

    employee = Employees.objects.filter(
        employee_id=emp_id, deleted_at__isnull=True
    ).first()

    if not employee:
        return Response(
            {"status": "error", "message": "잘못된 접근입니다."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    current_secret = getattr(employee, "otp_secret", None)

    if not current_secret:
        return Response(
            {
                "status": "error",
                "message": "OTP 설정이 되어있지 않습니다. 다시 로그인해주세요.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    totp = pyotp.TOTP(current_secret)
    if totp.verify(otp_code):
        client_ip = get_client_ip(request)
        # 웹 로그인은 네트워크 인증이 아니므로 online_list를 건드리지 않는다 (캡티브 포털에서만 기록)
        return Response(
            {
                "status": "success",
                "user": {
                    "emp_id": employee.employee_id,
                    "employee_id": employee.employee_id,
                    "name": employee.name,
                    "is_manager": employee.is_manager,
                    "online_ip": client_ip,
                },
            }
        )
    else:
        return Response(
            {
                "status": "error",
                "message": "OTP 인증 번호가 일치하지 않거나 만료되었습니다.",
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )


@api_view(["POST"])
def captive_login(request):
    emp_id = request.data.get("employee_id")
    is_test = request.data.get("is_test", False)  # 💡 테스트 플래그 확인

    if is_emp_blocked(emp_id):
        return Response(
            {
                "status": "error",
                "message": "접근 거부: 네트워크 접근이 차단된 사원입니다.",
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    employee = Employees.objects.filter(
        employee_id=emp_id, deleted_at__isnull=True
    ).first()
    if employee and check_password(request.data.get("password"), employee.password):
        client_ip = get_client_ip(request)

        # 💡 테스트 모드가 아닐 때만 실제 세션 및 PCAP 로깅 수행
        if not is_test:
            try:
                save_online_session(
                    employee, extract_ip_suffix(client_ip), timezone.now()
                )
                sync_pcap_json_files_in_background()
            except Exception as e:
                logger.error("캡티브 포털 로깅 실패: %s", e)

        return Response(
            {
                "status": "success",
                "message": f"{employee.name} 사원님 인증 완료.",
                "user": {
                    "emp_id": employee.employee_id,
                    "name": employee.name,
                    "online_ip": client_ip,
                },
            }
        )
    return Response(
        {"status": "error", "message": "인증 정보가 일치하지 않습니다."},
        status=status.HTTP_401_UNAUTHORIZED,
    )


@api_view(["POST"])
def logout_user(request):
    # 웹 로그아웃은 캡티브 포털 인증(online_list)에 영향을 주지 않는다
    return Response({"status": "success", "message": "로그아웃 처리되었습니다."})


@api_view(["GET", "PUT"])
def my_profile(request):
    try:
        emp = Employees.objects.get(
            employee_id=request.query_params.get("employee_id")
            or request.data.get("employee_id")
        )
    except Employees.DoesNotExist:
        return Response(
            {"status": "error", "message": "사용자를 찾을 수 없습니다."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.method == "GET":
        current_ym = (
            emp.hire_date.strftime("%Y%m")
            if getattr(emp, "hire_date", None)
            else "202610"
        )
        birth_date, masked_jumin = format_jumin_and_birth(getattr(emp, "jumin_no", ""))
        return Response(
            {
                "employee_id": emp.employee_id,
                "employee_number": emp.employee_number,
                "name": emp.name,
                "email": emp.email,
                "phone_number": emp.phone_number,
                "address": emp.address,
                "is_manager": emp.is_manager,
                "emp_code": f"ST{current_ym}{emp.employee_number:02d}"
                if emp.employee_number
                else "-",
                "jumin_no": masked_jumin,
                "birth_date": birth_date,
                "hire_date": emp.hire_date.strftime("%Y-%m-%d")
                if getattr(emp, "hire_date", None)
                else "-",
            }
        )

    if not check_password(request.data.get("current_password", ""), emp.password):
        return Response(
            {"status": "error", "message": "현재 비밀번호가 일치하지 않습니다."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # 이름·주민번호 등 필수 개인정보는 본인이 바꿀 수 없다 (이메일·연락처·주소·비밀번호만 허용)
    email = str(request.data.get("email", emp.email)).strip()
    phone_number = re.sub(r"[^0-9]", "", str(request.data.get("phone_number", emp.phone_number)))
    address = str(request.data.get("address", emp.address)).strip()
    new_password = str(request.data.get("new_password") or "").strip()

    error = None
    if "@" not in email:
        error = "올바른 이메일 형식이 아닙니다."
    elif len(phone_number) not in (10, 11):
        error = "연락처는 숫자 10~11자리로 입력해주세요."
    elif not address:
        error = "주소를 입력해주세요."
    elif new_password and len(new_password) < 4:
        error = "새 비밀번호는 4자 이상이어야 합니다."
    elif Employees.objects.filter(email=email).exclude(pk=emp.pk).exists():
        error = "이미 사용 중인 이메일입니다."
    elif Employees.objects.filter(phone_number=phone_number).exclude(pk=emp.pk).exists():
        error = "이미 사용 중인 연락처입니다."
    if error:
        return Response(
            {"status": "error", "message": error}, status=status.HTTP_400_BAD_REQUEST
        )

    emp.email, emp.phone_number, emp.address = email, phone_number, address
    if new_password:
        emp.password = make_password(new_password)
    emp.save()
    return Response({"status": "success", "message": "정보가 수정되었습니다."})


@api_view(["POST", "GET"])
def get_my_info(request):
    try:
        emp = Employees.objects.get(
            employee_id=request.data.get("employee_id")
            or request.query_params.get("employee_id")
        )
        current_ym = (
            emp.hire_date.strftime("%Y%m")
            if getattr(emp, "hire_date", None)
            else timezone.now().strftime("%Y%m")
        )
        birth_date, masked_jumin = format_jumin_and_birth(getattr(emp, "jumin_no", ""))
        session = OnlineList.objects.filter(employee=emp).first()
        return Response(
            {
                "status": "success",
                "data": {
                    "network_authenticated": bool(session),
                    "network_ip": f"192.168.2.{session.online_ip}" if session else None,
                    "network_auth_time": session.login_time.strftime("%Y-%m-%d %H:%M:%S")
                    if session and session.login_time
                    else None,
                    "emp_code": f"ST{current_ym}{emp.employee_number:02d}"
                    if getattr(emp, "employee_number", None)
                    else "-",
                    "employee_id": emp.employee_id,
                    "employee_number": emp.employee_number,
                    "name": emp.name,
                    "email": emp.email,
                    "address": emp.address,
                    "phone_number": emp.phone_number,
                    "jumin_no": masked_jumin,
                    "birth_date": birth_date,
                    "hire_date": emp.hire_date.strftime("%Y-%m-%d")
                    if getattr(emp, "hire_date", None)
                    else "-",
                    "is_manager": emp.is_manager,
                },
            }
        )
    except Employees.DoesNotExist:
        return Response(
            {"status": "error", "message": "사원 정보를 찾을 수 없습니다."},
            status=status.HTTP_404_NOT_FOUND,
        )
