from django.db import models
from django.utils import timezone


class DjangoMigrations(models.Model):
    id = models.BigAutoField(primary_key=True)
    app = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    applied = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "django_migrations"


class ProspectiveMembers(models.Model):
    members_table_id = models.AutoField(primary_key=True)
    member_id = models.CharField(unique=True, max_length=50)
    password = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    email = models.CharField(unique=True, max_length=255)
    address = models.CharField(max_length=255)
    phone_number = models.CharField(unique=True, max_length=11)
    jumin_no = models.CharField(unique=True, max_length=13)
    date_of_request = models.DateField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "prospective_members"


class Employees(models.Model):
    employee_number = models.AutoField(primary_key=True)
    employee_id = models.CharField(unique=True, max_length=50)
    password = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    email = models.CharField(unique=True, max_length=255)
    address = models.CharField(max_length=255)
    phone_number = models.CharField(unique=True, max_length=11)
    jumin_no = models.CharField(unique=True, max_length=13)
    hire_date = models.DateField(default=timezone.now)
    is_manager = models.BooleanField(default=False)
    deleted_at = models.DateField(blank=True, null=True)
    otp_secret = models.CharField(max_length=128, blank=True, null=True)

    class Meta:
        managed = False
        db_table = "employees"


class WhitelistAddr(models.Model):
    whitelist_id = models.AutoField(primary_key=True)
    whitelist_domain = models.CharField(max_length=255)
    deleted_at = models.DateField(blank=True, null=True)
    is_protected = models.BooleanField(default=False)
    source = models.CharField(max_length=50)

    class Meta:
        managed = False
        db_table = "whitelist_addr"


class BlacklistAddr(models.Model):
    blacklist_id = models.AutoField(primary_key=True)
    blacklist_domain = models.CharField(max_length=255)
    deleted_at = models.DateField(blank=True, null=True)
    source = models.CharField(max_length=50)

    class Meta:
        managed = False
        db_table = "blacklist_addr"


class OnlineList(models.Model):
    employee = models.OneToOneField(Employees, models.DO_NOTHING, primary_key=True)
    online_ip = models.IntegerField()
    login_time = models.DateTimeField(default=timezone.now)
    online_mac_addr = models.CharField(max_length=17)

    class Meta:
        managed = False
        db_table = "online_list"


class OnlineListLog(models.Model):
    online_list_log_id = models.AutoField(primary_key=True)
    employee = models.ForeignKey(Employees, models.DO_NOTHING)
    online_ip = models.IntegerField()
    login_time = models.DateTimeField(default=timezone.now)
    online_mac_addr = models.CharField(max_length=17)

    class Meta:
        managed = False
        db_table = "online_list_log"


class WebAccessLog(models.Model):
    web_access_log_id = models.AutoField(primary_key=True)
    online_list_log = models.ForeignKey(OnlineListLog, models.DO_NOTHING)
    target_url = models.CharField(max_length=255)
    access_flag = models.CharField(max_length=50)
    ai_score = models.FloatField(default=-1.0, blank=True, null=True)
    access_time = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "web_access_log"


class OnlineIpMacMismatchLog(models.Model):
    online_ip_mac_mismatch_log_id = models.AutoField(primary_key=True)
    online_list_log = models.ForeignKey(OnlineListLog, models.DO_NOTHING)
    mismatch_mac_addr = models.CharField(max_length=17)
    insert_time = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "online_ip_mac_mismatch_log"


class EqpRunTime(models.Model):
    eqp_run_time_id = models.AutoField(primary_key=True)
    work_start_time = models.TimeField()
    work_end_time = models.TimeField()
    waiting_time = models.TimeField()

    class Meta:
        managed = False
        db_table = "eqp_run_time"


class FixedWhitelistAddr(models.Model):
    fixed_whitelist_id = models.AutoField(primary_key=True)
    fixed_whitelist_domain = models.CharField(max_length=255)

    class Meta:
        managed = False
        db_table = "fixed_whitelist_addr"


class FixedBlacklistAddr(models.Model):
    fixed_blacklist_id = models.AutoField(primary_key=True)
    fixed_blacklist_domain = models.CharField(max_length=255)

    class Meta:
        managed = False
        db_table = "fixed_blacklist_addr"


class AiModelMetrics(models.Model):
    ai_model_metrics_id = models.AutoField(db_column="AI_model_metrics_id", primary_key=True)
    version_name = models.CharField(unique=True, max_length=50)
    model_algorithm = models.CharField(max_length=100)
    trained_at = models.DateTimeField()
    hyperparameters = models.JSONField(default=dict)
    tp_count = models.IntegerField()
    tn_count = models.IntegerField()
    fp_count = models.IntegerField()
    fn_count = models.IntegerField()
    accuracy = models.FloatField()
    precision = models.FloatField()
    f1_score = models.FloatField()
    is_active = models.BooleanField(default=False)

    class Meta:
        managed = False
        db_table = "AI_model_metrics"