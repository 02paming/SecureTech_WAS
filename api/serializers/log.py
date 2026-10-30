from rest_framework import serializers

from ..models import (
    EqpRunTime,
    OnlineIpMacMismatchLog,
    WebAccessLog,
)


class WebAccessLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebAccessLog
        fields = "__all__"


class OnlineIpMacMismatchLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = OnlineIpMacMismatchLog
        fields = "__all__"


class EqpRunTimeSerializer(serializers.ModelSerializer):
    class Meta:
        model = EqpRunTime
        fields = "__all__"
