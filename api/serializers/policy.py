from rest_framework import serializers

from ..models import (
    BlacklistAddr,
    FixedBlacklistAddr,
    FixedWhitelistAddr,
    WhitelistAddr,
)


class WhitelistAddrSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhitelistAddr
        fields = "__all__"


class BlacklistAddrSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlacklistAddr
        fields = "__all__"


class FixedWhitelistAddrSerializer(serializers.ModelSerializer):
    class Meta:
        model = FixedWhitelistAddr
        fields = "__all__"


class FixedBlacklistAddrSerializer(serializers.ModelSerializer):
    class Meta:
        model = FixedBlacklistAddr
        fields = "__all__"
