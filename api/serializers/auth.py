from rest_framework import serializers

from ..models import OnlineList, OnlineListLog


class OnlineListSerializer(serializers.ModelSerializer):
    class Meta:
        model = OnlineList
        fields = ("employee", "online_ip", "login_time", "online_mac_addr")


class OnlineListLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = OnlineListLog
        fields = "__all__"
