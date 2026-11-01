/* eslint-disable no-undef */
module.exports = {
  apps: [
    {
      name: 'securetech-backend',
      cwd: './',
      // 파이썬 실행 파일을 직접 지정하고, 관리자 명령어로 Gunicorn을 구동합니다.
      script: 'venv/bin/python',
      args: '-m gunicorn config.wsgi:application --workers 4 --bind 0.0.0.0:8000',
      interpreter: 'none',
      env: {
        DJANGO_SETTINGS_MODULE: 'config.settings',
        PYTHONPATH: './'
      }
    },
    {
      name: 'securetech-mac-alert',
      cwd: './',
      script: 'venv/bin/python',
      args: 'manage.py watch_mac_alerts',
      interpreter: 'none',
      env: {
        DJANGO_SETTINGS_MODULE: 'config.settings',
        PYTHONPATH: './'
      }
    },
    {
      name: 'securetech-frontend',
      cwd: './frontend',
      script: 'npx',
      args: 'serve -s dist -l 5173'
    }
  ]
};
