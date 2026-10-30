import json
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

# 💡 [수정] 통합된 모델 임포트 (WhitelistAddr, BlacklistAddr, WebAccessLog)
from api.models import (
  BlacklistAddr,
  Employees,
  OnlineListLog,
  ProspectiveMembers,
  WebAccessLog,
  WhitelistAddr,
)


class Command(BaseCommand):
  help = "매일 자정 실행: PCAP 접속 IP 초기화 및 만료 데이터(1달/5년) 자동 파기"

  def handle(self, *args, **options):
    now = timezone.now()
    today = now.date()

    # 1. PCAP 인가 IP 파일 자정 초기화
    with open("online_ip.json", "w", encoding="utf-8") as f:
      json.dump([], f, indent=4)
    self.stdout.write(self.style.SUCCESS("[1/4] online_ip.json 자정 초기화 완료"))

    # 2. 가입 대기자 30일 경과 건 자동 파기
    one_month_ago = today - timedelta(days=30)
    deleted_pending, _ = ProspectiveMembers.objects.filter(
        date_of_request__lte=one_month_ago
    ).delete()
    self.stdout.write(
        self.style.SUCCESS(
            f"[2/4] 만료된 가입 대기자 {deleted_pending}건 파기 완료"
        )
    )

    # 3. 5년 경과한 임시 삭제 사원 및 차단 정책 완전 파기
    five_years_ago = today - timedelta(days=5 * 365)
    del_emp, _ = Employees.objects.filter(
        deleted_at__lte=five_years_ago
    ).delete()

    # 💡 [수정] 통합된 WhitelistAddr, BlacklistAddr 모델 파기 실행
    del_pol = 0
    for Model in [WhitelistAddr, BlacklistAddr]:
      deleted_count, _ = Model.objects.filter(
          deleted_at__lte=five_years_ago
      ).delete()
      del_pol += deleted_count

    self.stdout.write(
        self.style.SUCCESS(
            f"[3/4] 5년 경과 삭제 데이터 정리 완료 (사원: {del_emp}, 정책:"
            f" {del_pol})"
        )
    )

    # 4. 5년 경과한 로그 데이터 완전 파기
    # 💡 [수정] BlacklistAddrAccessLog -> WebAccessLog로 변경
    del_access_log, _ = WebAccessLog.objects.filter(
        access_time__lte=now - timedelta(days=5 * 365)
    ).delete()
    del_ip_log, _ = OnlineListLog.objects.filter(
        login_time__lte=now - timedelta(days=5 * 365)
    ).delete()
    self.stdout.write(
        self.style.SUCCESS(
            "[4/4] 5년 경과 로그 정리 완료 (웹접근로그:"
            f" {del_access_log}, 접속로그: {del_ip_log})"
        )
    )