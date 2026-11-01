import traceback

from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import OnlineIpMacMismatchLog, OnlineListLog
from .utils import SERVER_ERROR_MESSAGE, logger


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

        return Response(
            {
                "status": "WARNING",
                "message": f"IP({mock_ip})에서 MAC 변조 시도 탐지 (탐지 MAC: {fake_mac})",
            }
        )
    except Exception as e:
        logger.error(f"MAC 스푸핑 오류: {e}\n{traceback.format_exc()}")
        return Response({"status": "ERROR", "message": SERVER_ERROR_MESSAGE}, status=500)
