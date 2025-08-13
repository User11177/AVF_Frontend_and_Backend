# config.py
import os

# JWT/Token 設定
JWT_SECRET = os.environ.get('JWT_SECRET') or 'l7PqKR9W4wUO7M7ykXuY5l6HyT1SNWBZkqHtFXOpZyJcA8VJ6doCyDFXtQ1Pv5yu'
JWT_ALGO = 'HS256'
ACCESS_TOKEN_EXPIRE = 60*30  # 單位：秒 
REFRESH_TOKEN_EXPIRE = 60 * 60 * 24 * 7  # 單位：秒 

# Email 設定
GMAIL_USER = os.environ.get('GMAIL_USER') or 'a0981900277a@gmail.com'
GMAIL_PASS = os.environ.get('GMAIL_PASS') or 'vabu vuml ktrr jpax'

# Twilio 設定
TWILIO_SID = os.environ.get('TWILIO_SID') or 'AC13b9b3fb58e4c115cc216aeb1933cbd6'
TWILIO_TOKEN = os.environ.get('TWILIO_TOKEN') or 'e37204b6da7f55257755b2d414dc31ae'
TWILIO_VERIFY_SID = os.environ.get('TWILIO_VERIFY_SID') or 'VA4292a0a6b6aad256ac6e59dc708e9dc6'

# AES 加密金鑰
AES_KEY = os.environ.get('AES_KEY') or 'ai4zj4KsFAqLNf2xBfDg9*VuP1svVb1fQ7YwMu8KmLAHksrxHqdjT8ZaH8cn!6as'

# 驗證碼 TTL
VERIFY_CODE_TTL = 600  # 10分鐘

# CORS 設定
ALLOWED_ORIGINS = [
    "http://localhost",
    "http://127.0.0.1",
    "https://8ef3e5f82ed5.ngrok-free.app",
    "https://avfcare.com",
    # 可以在這裡加自己的 domain
]

# DB 設定
DB_HOST = os.environ.get('DB_HOST') or '127.0.0.1'
DB_USER = os.environ.get('DB_USER') or 'root'
DB_PASSWORD = os.environ.get('DB_PASSWORD') or 'a921117'
DB_NAME = os.environ.get('DB_NAME') or 'app_db'

# RateLimit 設定
RATELIMIT_DEFAULT = "60/minute"

# 自動排程/爬蟲間隔（秒）
SCHEDULE_REFRESH_INTERVAL = 600  # 10分鐘