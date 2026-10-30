from rest_framework import serializers

from ..models import Employees, ProspectiveMembers


# 가입 대기자 직렬화[cite: 7]
class ProspectiveMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProspectiveMembers
        fields = "__all__"

# 사원 명부 직렬화 (사원번호, 입사일, 관리자 여부 포함)[cite: 7]
class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employees
        fields = (
            "employee_number",
            "employee_id",
            "name",
            "email",
            "phone_number",
            "address",
            "hire_date",
            "is_manager",
            "deleted_at",
        )