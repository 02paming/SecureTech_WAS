import json
import os
import socket
import sys
import urllib.request
from datetime import datetime
from urllib.parse import parse_qs

import django

# 1. 경로 설정: 현재 파일이 위치한 SecureTech_WAS 폴더를 장고의 Root 경로로 인식시킴
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 💡 2. Settings 교체: 루트 계정의 'backend_pcap_test.settings' 대신 일반 계정의 'config.settings'로 연결
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# 1. Django 환경 설정 및 MariaDB 10.3 버전 체크 우회
# os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_pcap_test.settings')
# from django.db.backends.base.base import BaseDatabaseWrapper
# BaseDatabaseWrapper.check_database_version_supported = lambda self: None
django.setup()

from django.db import close_old_connections, connection, transaction

from api.models import (
    AiModelMetrics,
    AiThresholdConfig,
    BlacklistAddr,
    Employees,
    OnlineIpMacMismatchLog,
    OnlineList,
    OnlineListLog,
    WebAccessLog,
    WhitelistAddr,
)

# 허용할 IP 목록
ALLOWED_IPS = ['192.168.3.243', '127.0.0.1']
HOST = '0.0.0.0'
PORT = 8080

# =========================================================
# [설정] 연동 변수명 및 PCAP 서버 주소
# =========================================================
KEY_EMP_NAME = 'emp_name'       # [___사원이름_변수명___]
KEY_EMP_NUM = 'emp_number'      # [___사원번호_변수명___]
KEY_CLIENT_IP = 'user_online_ip'     # [___접속PC_IP_변수명___]
KEY_CLIENT_MAC = 'user_online_mac'   # [___접속PC_MAC_변수명___]
KEY_BLACKLIST_DOMAIN = 'blacklist_domain' # [추가] 차단된 도메인 변수명
PCAP_SERVER_SYNC_URL = "http://192.168.3.243:5000/api/update_domains"
PCAP_SERVER_SYNC_ONLINE_LIST = "http://192.168.3.243:5000/api/update_online"
PCAP_SERVER_SYNC_POLICY = "http://192.168.3.243:5000/api/update_policy"  # 정책 동기화 목적지 URL
PCAP_SERVER_UPDATE_AI_THRESHOLD = "http://192.168.3.243:5000/api/update_ai_threshold"
PCAP_SERVER_UPDATE_AI_MODEL = "http://192.168.3.243:5000/api/update_ai_model"


# =========================================================
# [추가] 웹 서버(Django) 새로고침 요청 URL (블랙리스트 로그용)
# =========================================================
# 실제 구축한 웹 서버 API 경로로 변경
WEB_SERVER_BLACKLIST_REFRESH_URL = "http://127.0.0.1:8000/api/dashboard/threat-logs/" 

def execute_sync_domains(sync_type="black",action=None,domain=None):

    # 1. 단건 업데이트: 프론트에서 action(add/delete)과 domain을 넘겼을 때
    if action and domain:
        payload = json.dumps({
            "action": action,         # "add" 또는 "delete"
            "sync_type": sync_type,   # "black" 또는 "white"
            "domain": domain       # "hacker.com"
                
        }).encode('utf-8')
        
        try:
            req = urllib.request.Request(PCAP_SERVER_SYNC_URL, data=payload, headers={'Content-Type': 'application/json'})
            urllib.request.urlopen(req, timeout=3)
            print(f"   [{sync_type.upper()} 단건 갱신 완료]: {action} -> {domain}")
            return True, 1
        except Exception as e:
            print(f"   [{sync_type.upper()} 단건 갱신 실패]: PCAP 서버 에러 ({e})")
            return False, str(e)
            
    # 2. 전체 업데이트(갱신) 기존 구문 폐기할거같음
    # else:
    #     with connection.cursor() as cursor:
    #         if sync_type == "white":
    #             cursor.execute("SELECT whitelist_domain FROM whitelist_addr WHERE deleted_at IS NULL")
    #         else:
    #             cursor.execute("SELECT blacklist_domain FROM blacklist_addr WHERE deleted_at IS NULL")
                
    #         active_domains = cursor.fetchall()
            
    #     domain_list = [{"domain": row[0]} for row in active_domains]

    #     payload = json.dumps({
    #         "sync_type": sync_type,
    #         "domains": domain_list
    #     }).encode('utf-8')
                
    #     try:
    #         req = urllib.request.Request(PCAP_SERVER_SYNC_URL, data=payload, headers={'Content-Type': 'application/json'})
    #         urllib.request.urlopen(req, timeout=3)
    #         print(f"   [{sync_type.upper()} 전체 동기화 완료]: 총 {len(domain_list)}개 전송")
    #         return True, len(domain_list)
    #     except Exception as e:
    #         print(f"   [{sync_type.upper()} 전체 동기화 실패]: PCAP 서버 에러 ({e})")
    #         return False, str(e)
    

def trigger_blacklist_refresh():
    """블랙리스트 로그가 DB에 추가될 때 웹 서버로 알림(HTTP GET)을 보내는 함수"""
    try:
        req = urllib.request.Request(WEB_SERVER_BLACKLIST_REFRESH_URL, method="GET")
        urllib.request.urlopen(req, timeout=2)
        print("   [웹 서버 알림]: 블랙리스트 접근 로그 갱신 요청 전송 완료")
    except Exception as e:
        print(f"   [웹 서버 알림 실패]: {e}")

def parse_request_body(body_str):
    # print(f"🔥 [디버깅] 도착한 원본 데이터: {repr(body_str)}")
    body_str = body_str.strip()
    data = {}
    if not body_str:
        return data

    if body_str.startswith('{'):
        try:
            data = json.loads(body_str)
        except json.JSONDecodeError:
            pass
    elif '=' in body_str:
        parsed_qs = parse_qs(body_str)
        data = {k: v[0] for k, v in parsed_qs.items()}
    elif ',' in body_str:
        parts = [p.strip() for p in body_str.split(',')]
        if len(parts) >= 2:
            data[KEY_EMP_NUM] = parts[0]
            data[KEY_EMP_NAME] = parts[1]
        if len(parts) >= 3:
            data[KEY_CLIENT_IP] = parts[2]
        if len(parts) >= 4:
            data[KEY_CLIENT_MAC] = parts[3]
        if len(parts) >= 5:
            data[KEY_BLACKLIST_DOMAIN] = parts[4] # [추가] 5번째 인자로 도메인이 들어올 경우
    return data

def create_http_response(status_code, body_dict):
    status_text = "200 OK" if status_code == 200 else "400 Bad Request"
    if status_code == 403:
        status_text = "403 Forbidden"
    body_json = json.dumps(body_dict, ensure_ascii=False)
    response = (
        f"HTTP/1.1 {status_text}\r\n"
        f"Content-Type: application/json; charset=utf-8\r\n"
        f"Content-Length: {len(body_json.encode('utf-8'))}\r\n"
        f"Connection: close\r\n"
        f"\r\n"
        f"{body_json}"
    )
    return response.encode('utf-8')

def run_server():
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_socket.bind((HOST, PORT))
    server_socket.listen(5)

    print(f"=========================================================")
    print(f" [PCAP 인증 및 동기화 서버 구동] 포트: {PORT}")
    print(f" - 로그인/인증 경로 : POST /api/verify")
    print(f" - 로그아웃 경로   : POST /api/logout")
    print(f" - 개별차단추가/개별삭제 처리(델타)    : POST /api/sync_domains")
    print(f" - 초기 동기화용 활성 세션 리스트 조회 : GET  /api/active_sessions")
    print(f" - 방화벽 정책 동기화 DB 연동 : GET  /api/policy")    
    print(f" - 관리자 정책 실시간 동기화 트리거 : POST  /api/sync_policy")
    print(f" - 블랙리스트 로그 : POST /api/blacklist_log")
    print(f" - 관리자 지정 인증해제 : POST /api/expire_user") 
    print(f" - 일반 웹 접속 로그 저장 : POST /api/web_access_log") 
    print(f" - AI 모델 훈련 성적표 수신 및 장고 ORM 다이렉트 저장 : POST /api/ai_metrics_update")
    print(f" - AI 프로세스 부팅 시 초기 설정 동기화 API : GET /api/get_active_ai_config")
    print(f" - MAC 주소 불일치 (IP 스푸핑) 로그 저장 : POST /api/mac_mismatch_log")
    print(f"=========================================================")

    while True:
        client_sock, addr = server_socket.accept()
        client_ip = addr[0]

        # 1. IP 필터링 통과 여부와 상관없이 모든 연결을 강제 출력!
        print(f"[*] 연결 수신됨: {client_ip}")

        if client_ip not in ALLOWED_IPS:
            print(f"  [경고] 미인가 IP 차단됨: {client_ip}")
            try:
                client_sock.recv(4096)
            except Exception:
                pass
            client_sock.sendall(create_http_response(403, {"error": "Forbidden IP"}))
            client_sock.close()
            continue

        try:
            close_old_connections()

            raw_data = b""
            client_sock.settimeout(1.0) # 1초 이상 응답 없으면 끊기 (무한 대기 방지)
            
            try:
                # 1. 일단 처음 들어온 데이터 뭉치(주로 헤더)를 받는다
                chunk = client_sock.recv(4096)
                if not chunk:
                    print("  [에러] 수신된 데이터가 없습니다. (클라이언트가 즉시 끊음)")
                    client_sock.close()
                    continue
                raw_data += chunk
                
                # 2. 헤더와 바디를 분리하는 기준선(\r\n\r\n)이 다 들어왔는지 확인
                while b'\r\n\r\n' not in raw_data:
                    chunk = client_sock.recv(4096)
                    if not chunk:
                        break
                    raw_data += chunk
                
                # 3. 헤더 끝부분을 찾아서 분리
                header_bytes, separator, body_bytes = raw_data.partition(b'\r\n\r\n')
                header_str = header_bytes.decode('utf-8', errors='ignore')
                
                # 4. Content-Length 찾기 (바디가 얼마나 더 남았는지 확인)
                content_length = 0
                for line in header_str.splitlines():
                    if line.lower().startswith('content-length:'):
                        content_length = int(line.split(':')[1].strip())
                        break
                
                # 5. 부족한 바디 길이만큼 소켓에서 영혼까지 긁어모으기
                while len(body_bytes) < content_length:
                    chunk = client_sock.recv(4096)
                    if not chunk:
                        break
                    body_bytes += chunk
                
                # 6. 최종적으로 합치기
                body_str = body_bytes.decode('utf-8', errors='ignore')
                
            except socket.timeout:
                print("  [경고] 데이터 수신 중 타임아웃 발생 (일단 받은데까지만 처리 시도)")
                body_str = raw_data.decode('utf-8', errors='ignore')

            request_line = header_str.splitlines()[0] if header_str else ""
            parts = request_line.split(' ')

            method = parts[0] if len(parts) > 0 else "GET"
            path = parts[1] if len(parts) > 1 else "/api/verify"
            
            print(f"  [요청 분석]: {method} {path}")
            parsed = parse_request_body(body_str)

            # 파싱 데이터 준비
            raw_name = parsed.get(KEY_EMP_NAME) or parsed.get('name')
            raw_num = parsed.get(KEY_EMP_NUM) or parsed.get('employee_number')
            user_online_ip = parsed.get(KEY_CLIENT_IP)
            user_online_mac = parsed.get(KEY_CLIENT_MAC, "00:00:00:00:00:00")
            blacklist_domain = parsed.get(KEY_BLACKLIST_DOMAIN) or parsed.get('domain')

            # ---------------------------------------------------------
            # 1 차단추가/삭제 처리 (/api/sync_domains) //개별갱신부분(델타느낌)
            # ---------------------------------------------------------
            if path.startswith('/api/sync_domains'):

                sync_type = parsed.get("sync_type")
                action = parsed.get("action") #내일 웹백엔드쪽에서 보낼때 이거두개도 넣어서보내게해야함
                domain = parsed.get("domain") 
              
                success, result = execute_sync_domains(sync_type,action,domain) #여기서 분기태움

                if success:
                    res = {"is_sync_success": True, "count": result, "type": sync_type, "action": action}
                else:
                    res = {"is_sync_success": False, "error": result}
                
                client_sock.sendall(create_http_response(200, res))
                continue

            # ---------------------------------------------------------
            # 1-1 초기 동기화용 활성 도메인 리스트 조회 (GET /api/active_domains)
            # ---------------------------------------------------------
            if method == "GET" and path.startswith('/api/active_domains'):
                try:
                    domain_list = []

                    # 1. 활성화된 블랙리스트 파싱
                    active_blacks = BlacklistAddr.objects.filter(deleted_at__isnull=True)
                    for b in active_blacks:
                        domain_list.append({
                            "type": "black",
                            "domain": b.blacklist_domain,
                            "source": b.source,
                            "ai_score": b.ai_score if b.ai_score is not None else -1.0
                        })

                    # 2. 활성화된 화이트리스트 파싱
                    active_whites = WhitelistAddr.objects.filter(deleted_at__isnull=True)
                    for w in active_whites:
                        domain_list.append({
                            "type": "white",
                            "domain": w.whitelist_domain,
                            "source": w.source,
                            "ai_score": w.ai_score if w.ai_score is not None else -1.0
                        })

                    res = {
                        "status": "success",
                        "count": len(domain_list),
                        "data": domain_list
                    }
                    client_sock.sendall(create_http_response(200, res))
                    
                except Exception as e:
                    print(f"  [초기 도메인 조회 실패]: {e}")
                    client_sock.sendall(create_http_response(500, {"status": "error", "message": str(e)}))
                continue

            # ---------------------------------------------------------
            # 2. 내부망 로그아웃 처리 (/api/logout)
            # ---------------------------------------------------------
            if path.startswith('/api/logout'):
                if not user_online_ip:
                    res = {"is_logout": False, "message": "IP 정보가 제공되지 않았습니다."}
                else:
                    target_online_ip = int(user_online_ip)
                    
                    if user_online_mac and user_online_mac != "00:00:00:00:00:00":
                        deleted_cnt, _ = OnlineList.objects.filter(online_ip=target_online_ip, online_mac_addr=user_online_mac).delete()
                    else:
                        deleted_cnt, _ = OnlineList.objects.filter(online_ip=target_online_ip).delete()
                    
                    print(f"[내부망 로그아웃/만료 완료]: IP({target_online_ip}) 세션 제거됨 (삭제된 행: {deleted_cnt})")
                    res = {"is_logout": True, "deleted_count": deleted_cnt}
                    
                client_sock.sendall(create_http_response(200, res))
                continue

            # ---------------------------------------------------------
            # 3. 내부망 로그인 검증 및 중복 차단 (/api/verify)
            # ---------------------------------------------------------
            if path.startswith("/api/verify"):
                emp_name = str(raw_name).strip() if raw_name else ""
                emp_num = int(raw_num) if raw_num is not None else -1
                user_online_ip = int(str(user_online_ip).strip())
                user_online_mac = str(user_online_mac).strip() if user_online_mac else "UNKNOWN" 

                print(f"  [요청 정보]: 사번={emp_num}, 이름='{emp_name}', 접속IP='{user_online_ip}', 접속MAC='{user_online_mac}'")

                # 1. 일단 사원 번호와 이름으로 사원이 존재하는지, 그리고 상태 코드까지 같이 가져옵니다.
                employee = Employees.objects.select_related('status_code').filter(
                  employee_number=emp_num,
                  name=emp_name
                ).first()

                if employee:
                    # 상태 정보 변수화 (Employee 모델의 FK 이름이 status_code로 설정되어 있다고 가정)
                    # 만약 모델 필드 이름이 다르게 설정되어 있다면 그 이름에 맞게 수정하세요.
                    current_status_name = employee.status_code.status_name      # 예: 'ACTIVE', 'BANNED', 'RESIGNED'
                    current_display_name = employee.status_code.display_name    # 예: '정상', '이용정지', '퇴사'

                    # 2. 퇴사자 처리 (기존 로직 유지 + status_name 활용)
                    if employee.deleted_at is not None or current_status_name == 'RESIGNED':
                        print(f"  [검증 실패]: 퇴사한 사원입니다.")
                        result_data = {"is_valid": False, "reason": "resigned"}

                    # 3. 접근 제한자 처리 (이용정지, 휴가, 휴직 등 '정상'이 아닌 모든 상태)
                    elif current_status_name != 'ACTIVE':
                        print(f"  [검증 실패]: 접근 제한 사원 (사번: {emp_num}, 상태: {current_display_name}).")
                        # Flask에 "banned" 플래그와 함께 DB에 등록된 한글명(display_name)을 전달합니다.
                        result_data = {
                          "is_valid": False, 
                          "reason": "banned", 
                          "detail_msg": current_display_name
                        }
                    # 4. 정상 접속 처리 (current_status_name == 'ACTIVE')
                    else:
                        kick_host_id = None 

                        with transaction.atomic():
                            existing_session = OnlineList.objects.filter(employee_id=emp_num).first()
                            
                            if existing_session:
                                kick_host_id = existing_session.online_ip
                                print(f"  [중복 접속 처리]: 사번 {emp_num} 기존 IP({kick_host_id}) 밀어내기 진행.")
                                
                                existing_session.online_ip = user_online_ip
                                existing_session.online_mac_addr = user_online_mac
                                existing_session.save()
                            else:
                                OnlineList.objects.create(
                                    employee_id=emp_num, 
                                    online_ip=user_online_ip, 
                                    online_mac_addr=user_online_mac
                                )

                            with connection.cursor() as cursor:
                                cursor.execute(
                                    "INSERT INTO online_list_log (employee_id, online_ip, online_mac_addr) VALUES (%s, %s, %s)",
                                    [emp_num, user_online_ip, user_online_mac]
                                )

                        print(f"  [로그인 성공]: 사번 {emp_num}('{emp_name}') 접속 및 로그 기록 완료")
                        
                        result_data = {
                            "is_valid": True,
                            "kick_host_id": kick_host_id
                        }

                else:
                    print(f"  [검증 실패]: 이름과 사번이 일치하는 사원이 없습니다.")
                    result_data = {"is_valid": False, "reason": "not_found"}

                client_sock.sendall(create_http_response(200, result_data))
                continue

            # ---------------------------------------------------------
            # 4. 초기 동기화용 활성 세션 리스트 조회 (GET /api/active_sessions)
            # ---------------------------------------------------------
            if method == "GET" and path.startswith('/api/active_sessions'):
                try:
                    active_sessions = OnlineList.objects.all()
                    
                    session_list = []
                    for session in active_sessions:
                        login_timestamp = int(session.login_time.timestamp()) 
                        
                        session_list.append({
                            "host_id": session.online_ip,      
                            "mac": session.online_mac_addr,    
                            "login_time": login_timestamp      
                        })
                    
                    res = {
                        "status": "success", 
                        "count": len(session_list),
                        "data": session_list
                    }
                    client_sock.sendall(create_http_response(200, res))
                except Exception as e:
                    print(f"  [초기 세션 조회 실패]: {e}")
                    client_sock.sendall(create_http_response(500, {"status": "error", "message": str(e)}))
                continue

            # =========================================================
            # 4.5. 방화벽 정책 동기화 (/api/policy) - DB 연동
            # =========================================================
            if method == "GET" and path.startswith('/api/policy'):
                try:
                    # 1. DB에서 정책 시간 가져오기 (가장 최근 1건)
                    with connection.cursor() as cursor:
                        cursor.execute("SELECT work_start_time, work_end_time, waiting_time FROM eqp_run_time ORDER BY eqp_run_time_id DESC LIMIT 1")
                        row = cursor.fetchone()

                    if row:
                        db_start, db_end, db_interval = row
                        
                        # 2. C 프로그램이 원하는 정수 포맷으로 가공 (파싱)
                        # DB에서 꺼낸 시간이 문자열('07:00:00')이든 timedelta 객체든 문자열로 변환 후 쪼개기
                        start_h = int(str(db_start).split(':')[0])  # '07' -> 7
                        end_h = int(str(db_end).split(':')[0])      # '19' -> 19
                        
                        # '00:30:00' -> 초 단위 변환 (0*3600 + 30*60 + 0) -> 1800초
                        w_parts = str(db_interval).split(':')
                        interval_sec = int(w_parts[0]) * 3600 + int(w_parts[1]) * 60 + int(w_parts[2])
                    else:
                        # DB에 값이 없을 경우를 대비한 기본값
                        start_h, end_h, interval_sec = 9, 18, 600

                    res = {
                        "status": "success",
                        "data": {
                            "safe_zone_start": start_h,
                            "safe_zone_end": end_h,
                            "expire_interval": interval_sec
                        }
                    }
                    print(f"  [정책 조회 성공]: DB연동 완료 (출근:{start_h}시, 퇴근:{end_h}시, 주기:{interval_sec}초)")
                    
                except Exception as e:
                    print(f"  [정책 조회 실패]: DB 처리 에러 - {e}")
                    # DB 접속 에러 시 뻗지 않고 기본값을 주어 방어
                    res = {
                        "status": "error",
                        "data": {
                            "safe_zone_start": 9,
                            "safe_zone_end": 18,
                            "expire_interval": 600
                        }
                    }

                client_sock.sendall(create_http_response(200, res))
                continue

            # =========================================================
            # [신규 추가] 4.6. 관리자 정책 실시간 동기화 트리거 (/api/sync_policy)
            # =========================================================
            if method == "POST" and path.startswith('/api/sync_policy'):
                try:
                    # 1. DB에서 가장 최근 정책 가져오기
                    with connection.cursor() as cursor:
                        cursor.execute("SELECT work_start_time, work_end_time, waiting_time FROM eqp_run_time ORDER BY eqp_run_time_id DESC LIMIT 1")
                        row = cursor.fetchone()

                    if row:
                        db_start, db_end, db_interval = row
                        start_h = int(str(db_start).split(':')[0])
                        end_h = int(str(db_end).split(':')[0])
                        w_parts = str(db_interval).split(':')
                        interval_sec = int(w_parts[0]) * 3600 + int(w_parts[1]) * 60 + int(w_parts[2])
                    else:
                        start_h, end_h, interval_sec = 9, 18, 600

                    # 2. PCAP 서버(192.168.3.243)로 보낼 JSON 포장
                    payload = json.dumps({
                        "safe_zone_start": start_h,
                        "safe_zone_end": end_h,
                        "expire_interval": interval_sec
                    }).encode('utf-8')

                    # 3. PCAP 서버로 HTTP POST 전송 (통보)
                    req = urllib.request.Request(
                        PCAP_SERVER_SYNC_POLICY, 
                        data=payload, 
                        headers={'Content-Type': 'application/json'},
                        method='POST'
                    )
                    urllib.request.urlopen(req, timeout=3)
                    
                    print(f"  [실시간 정책 통보 완료]: PCAP 서버로 전송 성공 (출근 {start_h}시, 퇴근 {end_h}시, 주기 {interval_sec}초)")
                    res = {"status": "success", "message": "Policy synced to PCAP"}
                    client_sock.sendall(create_http_response(200, res))
                    
                except Exception as e:
                    print(f"  [실시간 정책 통보 실패]: {e}")
                    res = {"status": "error", "error": str(e)}
                    client_sock.sendall(create_http_response(500, res))
                continue

            # ---------------------------------------------------------
            # 5. [수정] 블랙리스트 접근 시도 로그 저장 (/api/blacklist_log)
            # ---------------------------------------------------------
            if method == "POST" and path.startswith('/api/blacklist_log'):
                logs_array = parsed.get("logs", [])
                
                # 단건 데이터 방어 코드
                if not logs_array and "client_ip" in parsed:
                    logs_array = [parsed]
                    
                bulk_insert_data = []
                success_count = 0
                
                for log_item in logs_array:
                    client_ip_str = log_item.get("client_ip")
                    target_domain = log_item.get("target_url")
                    status_code = log_item.get("status_code")
                    ai_score = log_item.get("ai_score")

                    if client_ip_str and target_domain:
                        try:
                            target_online_ip = int(str(client_ip_str).strip())
                            
                            # 블랙리스트(차단) 도메인 정책 갱신
                            if int(status_code) in [3, 4]:
                                source_val = "DOUBT" if int(status_code) == 4 else "AI"
                                policy = BlacklistAddr.objects.filter(blacklist_domain=target_domain).first()
                                if policy:
                                    if policy.deleted_at is not None:
                                        policy.deleted_at = None
                                        policy.source = source_val
                                        policy.ai_score = ai_score if ai_score is not None else -1.0
                                        policy.save()
                                else:
                                    BlacklistAddr.objects.create(blacklist_domain=target_domain, source=source_val, ai_score=ai_score if ai_score is not None else -1.0)

                            # 세션 찾아서 배열에 데이터(튜플)만 추가해둠
                            active_session = OnlineListLog.objects.filter(online_ip=target_online_ip).last()
                            if active_session:
                                bulk_insert_data.append((
                                    active_session.online_list_log_id, 
                                    target_domain, 
                                    "차단", 
                                    ai_score, 
                                    int(status_code)
                                ))
                                success_count += 1
                        except Exception as e:
                            print(f"  [데이터 준비 에러 - 블랙리스트]: {e}")
                            
                # for문이 다 끝난 뒤, 데이터가 모였으면 단 1번의 쿼리로 100개를 다 밀어넣음!
                if bulk_insert_data:
                    try:
                        with connection.cursor() as cursor:
                            cursor.executemany(
                                "INSERT INTO web_access_log (online_list_log_id, target_url, access_flag, ai_score, ai_status_code) VALUES (%s, %s, %s, %s, %s)",
                                bulk_insert_data
                            )
                    except Exception as e:
                        print(f"  [차단 로그 벌크 인서트 실패]: {e}")

                # 프론트엔드 대시보드 갱신 알림은 100개가 다 들어간 후 1번만 쏘도록 최적화
                if success_count > 0:
                    trigger_blacklist_refresh()
                    
                client_sock.sendall(create_http_response(200, {"status": "success", "processed": success_count}))
                continue

            # ---------------------------------------------------------
            # 6. [추가] 관리자가 지정ip 인증해제시키는 로직 (/api/expire_user)
            # ---------------------------------------------------------

            if method == "POST" and path.startswith('/api/expire_user'):
                # 1. 만들어두신 JSON 파서(parsed)에서 IP 꺼내기
                kick_host_id = parsed.get("kick_host_id")
                emp_id = parsed.get("emp_id")
                
                if kick_host_id:
                    # 2. PCAP 서버 PC로 토스할 JSON 재포장
                    payload = json.dumps({"kick_host_id": kick_host_id}).encode('utf-8')
                    
                    try:
                        req = urllib.request.Request(
                            PCAP_SERVER_SYNC_ONLINE_LIST, 
                            data=payload,
                            headers={'Content-Type': 'application/json'},
                            method="POST"
                        )
                        urllib.request.urlopen(req, timeout=3)
                        print(f"  [퇴출 신호 토스 완료]: ID {emp_id}, IP {kick_host_id}")
                        
                        # 3. 응답날리기 (에러별로 상태코드 나눠둠)
                        res = {"status": "success", "message": "PCAP 서버로 토스 성공"}
                        client_sock.sendall(create_http_response(200, res))
                        
                    except Exception as e:
                        print(f"  [퇴출 신호 토스 실패]: 접속 에러 ({e})")
                        res = {"status": "error", "error": str(e)}
                        client_sock.sendall(create_http_response(500, res))
                else:
                    # IP가 비어있을 경우 방어 코드
                    res = {"status": "error", "error": "kick_host_id 누락"}
                    client_sock.sendall(create_http_response(400, res))
                continue

            # ---------------------------------------------------------
            # 7. [수정] 일반 웹 접속 로그 저장 및 AI 승인 도메인 화이트리스트 등록 (/api/web_access_log)
            # ---------------------------------------------------------

            if method == "POST" and path.startswith('/api/web_access_log'):
                logs_array = parsed.get("logs", [])
                if not logs_array and "client_ip" in parsed:
                    logs_array = [parsed]
                    
                # 쿼리를 100번 날리지 않고 한 번에 넣기 위해 데이터를 모을 배열
                bulk_insert_data = []
                success_count = 0
                
                for log_item in logs_array:
                    status_code = log_item.get("status_code")
                    target_domain = log_item.get('target_url')
                    client_ip_str = log_item.get('client_ip')
                    ai_score = log_item.get("ai_score")
                    print
                    if client_ip_str and target_domain:
                        try:
                            target_online_ip = int(str(client_ip_str).strip())
                            
                            # 화이트리스트 갱신 로직
                            if int(status_code) in [5,6]:
                                source_val = "DOUBT" if int(status_code) == 5 else "AI"
                                policy = WhitelistAddr.objects.filter(whitelist_domain=target_domain).first()
                                if policy:
                                    if policy.deleted_at is not None:
                                        policy.deleted_at = None
                                        policy.source = source_val
                                        policy.ai_score = ai_score if ai_score is not None else -1.0
                                        policy.save()
                                else:
                                    WhitelistAddr.objects.create(whitelist_domain=target_domain, source=source_val, ai_score=ai_score if ai_score is not None else -1.0)

                            # 세션 찾아서 배열에 데이터(튜플)만 쏙쏙 추가해둠 
                            active_session = OnlineListLog.objects.filter(online_ip=target_online_ip).last()
                            if active_session:
                                bulk_insert_data.append((
                                    active_session.online_list_log_id, 
                                    target_domain, 
                                    "정상", 
                                    ai_score, 
                                    int(status_code)
                                ))
                                success_count += 1
                        except Exception as e:
                            print(f"  [데이터 준비 에러]: {e}")
                
                # for문이 다 끝난 뒤, 데이터가 모였으면 단 1번의 쿼리로 100개를 다 밀어넣음!
                if bulk_insert_data:
                    try:
                        with connection.cursor() as cursor:
                            cursor.executemany(
                                "INSERT INTO web_access_log (online_list_log_id, target_url, access_flag, ai_score, ai_status_code) VALUES (%s, %s, %s, %s, %s)",
                                bulk_insert_data
                            )
                    except Exception as e:
                        print(f"  [벌크 인서트 실패]: {e}")

                client_sock.sendall(create_http_response(200, {"is_logged": True, "processed": success_count}))
                continue

        
            
            # ---------------------------------------------------------
            # 8. [추가] AI 모델 훈련 성적표 수신 및 장고 ORM 다이렉트 저장 (/api/ai_metrics_update)
            # ---------------------------------------------------------
            if method == "POST" and path.startswith('/api/ai_metrics_update'):
                try:
                    parsed_data = json.loads(body_bytes.decode('utf-8'))
                    
                    # 딕셔너리에서 필요한 데이터 추출
                    cm = parsed_data.get("confusion_matrix", {})
                    scores = parsed_data.get("scores", {})
                    
                    existing_count = AiModelMetrics.objects.count()
            
                    is_active_val = True if existing_count == 0 else False

                    # RAW SQL 대신 장고 ORM으로 깔끔하게 INSERT (.create)
                    AiModelMetrics.objects.create(
                        version_name = parsed_data.get("version"),
                        model_algorithm = parsed_data.get("model_type"),
                        trained_at = parsed_data.get("trained_at"),
                        hyperparameters = json.dumps(parsed_data.get("hyperparameters", {})),
                        tp_count = cm.get("TP", 0),
                        tn_count = cm.get("TN", 0),
                        fp_count = cm.get("FP", 0),
                        fn_count = cm.get("FN", 0),
                        accuracy = scores.get("accuracy", 0.0),
                        precision = scores.get("precision", 0.0),
                        f1_score = scores.get("f1_score", 0.0),
                        is_active = is_active_val
                    )
                    print(f"  [AI 훈련 갱신]: {parsed_data.get('version')} 성적표 ORM 저장 성공!")
                    res = {"status": "success"}
                    
                except Exception as e:
                    print(f"  [AI 훈련 갱신 에러]: ORM 저장 실패 - {e}")
                    res = {"status": "error", "error": str(e)}

                client_sock.sendall(create_http_response(200, res))
                continue

            # =====================================================================
            # 9. [추가] AI 프로세스 부팅 시 초기 설정 동기화 API (GET /api/get_active_ai_config)
            # =====================================================================
            if method == "GET" and path.startswith('/api/get_active_ai_config'):
                try:
                    
                    # 1. 활성화된(is_active=True) 모델 조회 (없으면 기본값 v1.0)
                    active_model = AiModelMetrics.objects.filter(is_active=True).first()
                    version_name = active_model.version_name if active_model else "v1.0"
                    
                    # 2. 실시간 임계치 조회 
                    threshold = AiThresholdConfig.objects.order_by('-config_id').first()
                    
                    if threshold:
                        b_limit = float(threshold.black_limit)
                        bd_limit = float(threshold.black_doubt_limit)
                        wd_limit = float(threshold.white_doubt_limit)
                    else:
                        b_limit, bd_limit, wd_limit = 70.0, 51.0, 31.0

                    # 3. JSON으로 예쁘게 묶어서 반환
                    res_data = {
                        "version_name": version_name,
                        "black_limit": b_limit,
                        "black_doubt_limit": bd_limit,
                        "white_doubt_limit": wd_limit
                    }
                    
                    client_sock.sendall(create_http_response(200, res_data))
                    print(f" [AI 동기화 지원]: {version_name} 및 임계치 정보 전송 완료")
                    continue

                except Exception as e:
                    print(f" [AI 동기화 에러]: {e}")
                    client_sock.sendall(create_http_response(500, {"error": str(e)}))
                    continue


            # =====================================================================
            # 10.  AI 임계치 변경 (8000(웹백엔드) -> 8080(현재,pcap백엔드) -> Flask(pcap서버))
            # =====================================================================
            if method == "POST" and path.startswith('/api/update_ai_threshold'):
                try:
                    # 1. Django가 보낸 JSON 데이터를 그대로 재포장
                    payload = json.dumps({
                        "white_doubt_limit": parsed.get("white_doubt_limit"),
                        "black_doubt_limit": parsed.get("black_doubt_limit"),
                        "black_limit": parsed.get("black_limit")
                    }).encode('utf-8')
                    
                    req = urllib.request.Request(
                        PCAP_SERVER_UPDATE_AI_THRESHOLD, 
                        data=payload, 
                        headers={'Content-Type': 'application/json'},
                        method='POST'
                    )
                    urllib.request.urlopen(req, timeout=3)
                    
                    print(" AI 임계치 변경 요청을 전달했습니다.")
                    client_sock.sendall(create_http_response(200, {"status": "success"}))
                    
                except Exception as e:
                    print(f" AI 임계치 전달 실패 - {e}")
                    client_sock.sendall(create_http_response(500, {"status": "error", "error": str(e)}))
                continue

            # =====================================================================
            # 11.  AI 모델 가동 전환 (8000(웹백엔드) -> 8080(현재,pcap백엔드) -> Flask(pcap서버))
            # =====================================================================
            if method == "POST" and path.startswith('/api/update_ai_model'):
                try:
                    payload = json.dumps({
                        "model_version": parsed.get("model_version")
                    }).encode('utf-8')
                    

                    req = urllib.request.Request(
                        PCAP_SERVER_UPDATE_AI_MODEL, 
                        data=payload, 
                        headers={'Content-Type': 'application/json'},
                        method='POST'
                    )
                    urllib.request.urlopen(req, timeout=3)
                    
                    print(f" AI 모델 가동({parsed.get('model_version')}) 요청을 전달했습니다.")
                    client_sock.sendall(create_http_response(200, {"status": "success"}))
                    
                except Exception as e:
                    print(f" AI 모델 전달 실패 - {e}")
                    client_sock.sendall(create_http_response(500, {"status": "error", "error": str(e)}))
                continue

            # ---------------------------------------------------------
            # 12. MAC 주소 불일치 (IP 스푸핑) 로그 저장 (/api/mac_mismatch_log)
            # ---------------------------------------------------------
            if method == "POST" and path.startswith('/api/mac_mismatch_log'):
                # 1. 딕셔너리에서 데이터 추출 
                client_ip_str = parsed.get("client_ip")
                mismatch_mac = parsed.get("mismatch_mac")

                if client_ip_str and mismatch_mac:
                    try:
                        # 2. IP를 기존 로직과 동일하게 정수(int)로 변환
                        target_online_ip = int(str(client_ip_str).strip())
                        
                        # 3. 해당 IP의 가장 최근 정상 세션(online_list_log_id) 조회
                        active_session = OnlineListLog.objects.filter(online_ip=target_online_ip).last()
                        
                        if active_session:
                            # 4. DB 테이블에 단건 Insert (Raw SQL 사용)
                            with connection.cursor() as cursor:
                                cursor.execute(
                                    "INSERT INTO online_ip_mac_mismatch_log (online_list_log_id, mismatch_mac_addr) VALUES (%s, %s)",
                                    [active_session.online_list_log_id, mismatch_mac]
                                )
                            print(f"  [MAC 불일치 로그 저장 완료]: IP({target_online_ip}) / MAC({mismatch_mac})")
                            res = {"status": "success", "message": "Log saved successfully"}
                        else:
                            print(f"  [MAC 불일치 에러]: IP({target_online_ip})에 해당하는 활성 세션(online_list_log_id)이 없습니다.")
                            res = {"status": "error", "error": "No active session found"}
                            
                    except Exception as e:
                        print(f"  [MAC 불일치 DB 저장 에러]: {e}")
                        res = {"status": "error", "error": str(e)}
                else:
                    res = {"status": "error", "error": "Missing client_ip or mismatch_mac"}

                client_sock.sendall(create_http_response(200, res))
                continue
            
            # =========================================================
            # [여기에 새로 추가] 매칭되는 API가 없을 경우 (Silent Drop 방지)
            # =========================================================
            print(f"  [에러] 지원하지 않는 API 요청: {method} {path}")
            client_sock.sendall(create_http_response(404, {"error": "Not Found"}))
            continue
    
        except Exception as e:
            print(f"[에러 발생]: {e}")
            client_sock.sendall(create_http_response(200, {"is_valid": False}))
        finally:
            client_sock.close()

if __name__ == '__main__':
    run_server()