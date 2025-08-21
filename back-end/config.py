# config.py
# 專案配置文件 - 集中管理所有系統設定
# 包含資料庫連線、JWT設定、第三方服務設定等
import os

# =================================
# JWT (JSON Web Token) 設定
# =================================
# JWT 是用於用戶身份驗證的 token 機制
JWT_SECRET = os.environ.get('JWT_SECRET') or 'l7PqKR9W4wUO7M7ykXuY5l6HyT1SNWBZkqHtFXOpZyJcA8VJ6doCyDFXtQ1Pv5yu'  # JWT 簽名密鑰
JWT_ALGO = 'HS256'  # 使用 HMAC SHA-256 演算法進行簽名
ACCESS_TOKEN_EXPIRE = 60*30  # 存取令牌有效期：30分鐘
REFRESH_TOKEN_EXPIRE = 60 * 60 * 24 * 7  # 刷新令牌有效期：7天

# JWT 標準欄位設定 (RFC 7519)
JWT_ISSUER = os.environ.get('JWT_ISSUER') or 'avf-healthcare-api'      # iss: 簽發者
JWT_AUDIENCE = os.environ.get('JWT_AUDIENCE') or 'avf-healthcare-app'  # aud: 預期受眾 

# =================================
# 第三方服務設定
# =================================
# Gmail SMTP 服務設定 (用於發送驗證碼)
GMAIL_USER = os.environ.get('GMAIL_USER') or 'a0981900277a@gmail.com'  # Gmail 帳號
GMAIL_PASS = os.environ.get('GMAIL_PASS') or 'vabu vuml ktrr jpax'      # Gmail 應用程式密碼

# Twilio SMS 服務設定 (用於發送手機驗證碼)
TWILIO_SID = os.environ.get('TWILIO_SID') or 'AC13b9b3fb58e4c115cc216aeb1933cbd6'      # Twilio 帳號 SID
TWILIO_TOKEN = os.environ.get('TWILIO_TOKEN') or 'e37204b6da7f55257755b2d414dc31ae'      # Twilio 認證 Token
TWILIO_VERIFY_SID = os.environ.get('TWILIO_VERIFY_SID') or 'VA4292a0a6b6aad256ac6e59dc708e9dc6'  # Twilio 驗證服務 SID

# =================================
# 加密設定
# =================================
# AES 對稱加密金鑰 (用於敏感資料加密)
AES_KEY = os.environ.get('AES_KEY') or 'ai4zj4KsFAqLNf2xBfDg9*VuP1svVb1fQ7YwMu8KmLAHksrxHqdjT8ZaH8cn!6as'

# 驗證碼有效期設定
VERIFY_CODE_TTL = 600  # 驗證碼存活時間：10分鐘

# =================================
# 網路安全設定
# =================================
# CORS (跨域資源共享) 允許的來源
ALLOWED_ORIGINS = [
    "http://localhost",                        # 本地開發環境
    "http://127.0.0.1",                       # 本地環境 IP
    "https://avfcare.com",                    # 正式域名
    "https://6a61cd76388e.ngrok-free.app",   # 舊的 ngrok URL
    "https://b7ae1d4d628d.ngrok-free.app",   # 新的 ngrok URL
    # 可以在這裡加自己的 domain
]

# =================================
# 資料庫連線設定
# =================================
DB_HOST = os.environ.get('DB_HOST') or '127.0.0.1'        # 資料庫主機位址
DB_USER = os.environ.get('DB_USER') or 'root'             # 資料庫用戶名
DB_PASSWORD = os.environ.get('DB_PASSWORD') or 'a921117'  # 資料庫密碼
DB_NAME = os.environ.get('DB_NAME') or 'app_db'           # 資料庫名稱

# =================================
# API 速率限制設定 (防止濫用攻擊)
# =================================
RATELIMIT_DEFAULT = "60/minute"  # 預設限制：每分鐘60次請求

# 各API端點的專門速率限制
RATE_LIMITS = {
    # 認證相關 - 高風險操作，較嚴格限制 (防止暴力破解)
    "auth_request_otp": "10/minute",      # 請求驗證碼：每分鐘10次
    "auth_verify_otp": "10/minute",       # 驗證驗證碼：每分鐘10次
    "auth_set_password": "5/minute",      # 設定密碼：每分鐘5次
    "auth_login": "5/minute",             # 登入：每分鐘5次
    "auth_request_reset": "5/minute",     # 請求重設密碼：每分鐘5次
    "auth_reset_password": "5/minute",    # 重設密碼：每分鐘5次
    
    # 用戶管理 - 中等限制 (管理員操作)
    "users_create": "30/minute",          # 建立用戶：每分鐘30次
    "users_update": "30/minute",          # 更新用戶：每分鐘30次
    "users_delete": "10/minute",          # 刪除用戶：每分鐘10次 (危險操作，限制更嚴格)
}

# =================================
# 自動化任務設定
# =================================
SCHEDULE_REFRESH_INTERVAL = 600  # 自動排程爬蟲執行間隔：10分鐘