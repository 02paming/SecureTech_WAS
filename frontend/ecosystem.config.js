/* eslint-disable no-undef */
module.exports = {
  apps: [
    {
      name: 'securetech-backend',
      cwd: '../', 
      script: 'venv/bin/gunicorn',
      // 🚨 주의: 아래 'config.wsgi'에서 'config' 부분을 실제 wsgi.py 파일이 들어있는 폴더 이름으로만 바꿔주세요! (보통 config 또는 backend 입니다)
      args: '--workers 4 --bind 0.0.0.0:8000 config.wsgi:application'
    },
    {
      name: 'securetech-frontend',
      cwd: './frontend', 
      script: 'npx',
      args: 'serve -s dist -l 5173' 
    }
  ]
};