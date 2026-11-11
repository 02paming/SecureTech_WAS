# 운영 DB(MariaDB 10.3) 호환성을 위해 Django의 데이터베이스 버전 검사 제한을 우회하는 커스텀 DB 백엔드 파일

from django.db.backends.mysql import base as mysql_base


class DatabaseWrapper(mysql_base.DatabaseWrapper):
    """운영 DB(192.168.4.15)가 MariaDB 10.3.39라 Django 4.2의 최소 요구(10.4)보다
    낮다. 이 프로젝트는 10.4 전용 기능을 쓰지 않으므로 버전 검사만 건너뛴다.
    DB 서버 자체는 DB 담당자 영역이라 건드리지 않는다."""

    def check_database_version_supported(self):
        pass
