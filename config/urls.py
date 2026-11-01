from django.contrib import admin
from django.urls import path

from api.views import (
    auth_views,
    dashboard_views,
    employee_views,
    log_views,
    policy_views,
    test_views,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/signup/", auth_views.apply_signup, name="apply_signup"),
    path(
        "api/auth/check-duplicate/", auth_views.check_duplicate, name="check_duplicate"
    ),
    path(
        "api/approvals/pending/",
        employee_views.get_pending_members,
        name="get_pending_members",
    ),
    path(
        "api/approvals/approve/", employee_views.approve_member, name="approve_member"
    ),
    path("api/approvals/reject/", employee_views.reject_member, name="reject_member"),
    path("api/auth/login/", auth_views.login, name="login"),
    path("api/auth/verify-otp/", auth_views.verify_otp, name="verify_otp"),
    path("api/auth/captive-login/", auth_views.captive_login, name="captive_login"),
    path("api/auth/logout/", auth_views.logout_user, name="logout"),
    path("api/auth/my-info/", auth_views.get_my_info, name="get_my_info"),
    path("api/auth/profile/", auth_views.my_profile, name="my_profile"),
    path("api/employees/", employee_views.get_employees, name="get_employees"),
    path(
        "api/employees/update/", employee_views.update_employee, name="update_employee"
    ),
    path(
        "api/employees/delete/", employee_views.delete_employee, name="delete_employee"
    ),
    path(
        "api/employees/hard-delete/",
        employee_views.hard_delete_employee,
        name="hard_delete_employee",
    ),
    path(
        "api/dashboard/employee-auth-status/",
        employee_views.get_employee_auth_status,
        name="get_employee_auth_status",
    ),
    path(
        "api/dashboard/employee-security/<str:emp_id>/",
        employee_views.get_employee_security_detail,
        name="get_employee_security_detail",
    ),
    path(
        "api/dashboard/block-employee/",
        employee_views.block_employee,
        name="block_employee",
    ),
    path(
        "api/dashboard/unblock-employee/",
        employee_views.unblock_employee,
        name="unblock_employee",
    ),
    path("api/policies/blocklist/", policy_views.get_blocklist, name="get_blocklist"),
    path("api/policies/add/", policy_views.add_policy, name="add_policy"),
    path("api/policies/delete/", policy_views.delete_policy, name="delete_policy"),
    path("api/policies/whitelist/", policy_views.get_whitelist, name="get_whitelist"),
    path(
        "api/policies/whitelist/add/", policy_views.add_whitelist, name="add_whitelist"
    ),
    path(
        "api/policies/whitelist/delete/",
        policy_views.delete_whitelist,
        name="delete_whitelist",
    ),
    # 관리자 ID/PW 인증 및 IP 제한(192.168.3.23) 기반 보호 도메인 제어 라우팅
    path(
        "api/policies/whitelist/upgrade/",
        policy_views.upgrade_whitelist,
        name="upgrade_whitelist",
    ),
    path(
        "api/policies/whitelist/force-delete/",
        policy_views.force_delete_whitelist,
        name="force_delete_whitelist",
    ),
    path(
        "api/policies/report-violation/",
        log_views.report_violation,
        name="report_violation_policy",
    ),
    path(
        "api/threats/report/",
        log_views.report_violation,
        name="report_violation_threat",
    ),
    path(
        "api/dashboard/threat-logs/", log_views.get_threat_logs, name="get_threat_logs"
    ),
    path("api/dashboard/online/", dashboard_views.get_online_users, name="get_online_users"),
    path(
        "api/dashboard/external/",
        dashboard_views.get_external_access_logs,
        name="get_external_access_logs",
    ),
    path(
        "api/dashboard/traffic-stats/",
        dashboard_views.get_traffic_stats,
        name="get_traffic_stats",
    ),
    path(
        "api/test/mac-spoofing/", test_views.test_mac_spoofing, name="test_mac_spoofing"
    ),
    path("blocklist/", policy_views.get_blocklist),
    path("report-violation/", log_views.report_violation),
    path("signup/", auth_views.apply_signup),
    path("login/", auth_views.login),
    path(
        "api/dashboard/eqp-run-time/",
        dashboard_views.manage_eqp_run_time,
        name="manage_eqp_run_time",
    ),
    path(
        "api/dashboard/domain-detail/<str:domain>/",
        log_views.get_domain_detail,
        name="get_domain_detail",
    ),
    path(
        "api/dashboard/integrated-logs/",
        log_views.get_integrated_logs,
        name="get_integrated_logs",
    ),
    path(
        "api/policies/promote/",
        policy_views.promote_ai_policy,
        name="promote_ai_policy",
    ),
    path("api/policies/ai/", policy_views.get_ai_policies, name="get_ai_policies"),
    path(
        "api/policies/ai/metrics/",
        policy_views.get_ai_model_metrics,
        name="get_ai_model_metrics",
    ),
]
