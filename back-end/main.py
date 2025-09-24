# main.py
# FastAPI 應用程式主入口
# 負責應用程式初始化、中間件設定、路由註冊等核心功能

# 導入 FastAPI 核心模組
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware  # 跨域資源共享中間件
from slowapi import Limiter                         # 速率限制
from slowapi.util import get_remote_address        # 取得客戶端 IP
from slowapi.errors import RateLimitExceeded       # 速率限制異常
from fastapi.responses import JSONResponse         # JSON 回應
from loguru import logger                          # 日誌記錄
import os
from dotenv import load_dotenv                     # 載入環境變數
load_dotenv()  # 從 .env 檔案載入環境變數

# =================================
# FastAPI 應用程式初始化
# =================================
app = FastAPI(
    title="AVFcare API",           # API 標題
)

# =================================
# CORS (跨域資源共享) 設定
# =================================
# 導入配置文件中的設定
from config import ALLOWED_ORIGINS, RATELIMIT_DEFAULT, RATE_LIMITS, SCHEDULE_REFRESH_INTERVAL

# 添加 CORS 中間件，允許前端跨域訪問
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,     # 允許的來源域名
    allow_credentials=True,            # 允許攜帶認證信息 ( headers)
    allow_methods=["*"],               # 允許所有 HTTP 方法
    allow_headers=["*"],               # 允許所有 HTTP 頭
)

# =================================
# API 速率限制設定 (防止 DDoS 攻擊)
# =================================
# 建立速率限制器，根據客戶端 IP 進行限制
limiter = Limiter(
    key_func=get_remote_address,           # 根據 IP 地址識別客戶端
    default_limits=[RATELIMIT_DEFAULT]     # 預設限制：每分鐘60次請求
)
app.state.limiter = limiter  # 將限制器綁定到應用程式狀態

# 速率限制異常處理器
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    """
    當客戶端超過速率限制時的處理函數
    回傳 HTTP 429 (Too Many Requests) 狀態碼
    """
    return JSONResponse(
        status_code=429, 
        content={
            "success": False, 
            "message": "請求過於頻繁，請稍後再試"
        }
    )

# =================================
# 日誌系統設定
# =================================
# 使用 Loguru 進行高效日誌記錄
logger.add(
    "logs/app.log",          # 日誌檔案路徑
    rotation="1 week",       # 每週輪替一次日誌檔案
    serialize=True           # 序列化為 JSON 格式
)

# =================================
# 路由器模組導入
# =================================
from routers import auth, users, patient, schedule, announcement, health_info, samples, doctor, chat, websocket, admin

# =================================
# 集中配置 API 速率限制
# =================================
"""
統一為重要的 API 端點應用速率限制。所有限制配置都在 config.py 中定義。
"""

# 為認證相關端點應用嚴格的速率限制 (防止暴力攻擊)
auth.request_otp = limiter.limit(RATE_LIMITS["auth_request_otp"])(auth.request_otp)       # 請求 OTP
auth.verify_otp = limiter.limit(RATE_LIMITS["auth_verify_otp"])(auth.verify_otp)          # 驗證 OTP
auth.set_password = limiter.limit(RATE_LIMITS["auth_set_password"])(auth.set_password)    # 設定密碼
auth.login = limiter.limit(RATE_LIMITS["auth_login"])(auth.login)                         # 用戶登入
auth.request_reset = limiter.limit(RATE_LIMITS["auth_request_reset"])(auth.request_reset) # 請求重設密碼
auth.reset_password = limiter.limit(RATE_LIMITS["auth_reset_password"])(auth.reset_password) # 重設密碼

# 為用戶管理端點應用中等速率限制 (管理員功能)
users.create_user = limiter.limit(RATE_LIMITS["users_create"])(users.create_user)    # 建立用戶
users.update_user = limiter.limit(RATE_LIMITS["users_update"])(users.update_user)    # 更新用戶
users.delete_user = limiter.limit(RATE_LIMITS["users_delete"])(users.delete_user)    # 刪除用戶

# =================================
# 路由器註冊 (模組化API架構)
# =================================
"""
將不同功能的 API 端點分散到各個路由器中：
- auth: 身份驗證相關
- users: 用戶管理
- patient: 病患資料
- schedule: 排程管理
- announcement: 公告系統
- health_info: 健康資訊
- samples: 樣本管理
"""

# 健康檢查端點
@app.get("/health")
async def health_check():
    """
    健康檢查端點
    用於檢查服務是否正常運行
    """
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "service": "AVFcare API",
        "version": "1.0.0"
    }

app.include_router(auth.router)           # 身份驗證路由
app.include_router(users.router)          # 用戶管理路由
app.include_router(patient.router)        # 病患資料路由
app.include_router(schedule.router)       # 排程管理路由
app.include_router(announcement.router)   # 公告系統路由
app.include_router(health_info.router)    # 健康資訊路由
app.include_router(samples.router)        # 樣本管理路由
app.include_router(doctor.router)         # 醫師功能路由
app.include_router(chat.router)           # 聊天室路由
app.include_router(admin.router)          # 管理員功能路由

# =================================
# 維護模式中間件
# =================================
from fastapi import Request
from routers.admin import is_maintenance_mode, get_maintenance_response

@app.middleware("http")
async def maintenance_middleware(request: Request, call_next):
    """
    維護模式中間件
    當系統處於維護模式時，攔截所有寫入操作
    
    ⚠️  重要安全考量：
    - 必須允許管理員登入，否則無人能關閉維護模式
    - 必須允許 token 刷新，維持管理員會話
    - 必須允許管理員 API，確保系統可管理性
    """
    # 檢查是否處於維護模式
    if is_maintenance_mode():
        # 允許的路徑：健康檢查、管理員API、讀取操作、必要的認證功能
        allowed_paths = [
            "/health",
            "/api/admin/",
            "/api/announcements",    # 允許讀取公告
            "/api/auth/refresh",     # 允許刷新token
            "/api/auth/login",       # 🔑 允許登入（管理員必須能登入才能關閉維護模式）
            "/api/auth/google-login", # 允許 Google 登入
            "/api/auth/request-reset", # 允許請求重置密碼（防止管理員忘記密碼）
            "/api/auth/reset-password", # 允許重置密碼
            "/api/oauth/redirect",    # 允許 Google OAuth ID Token 重導
            "/api/oauth/google/callback", # 允許 Google OAuth 回調
            "/api/auth/google-callback",  # 允許 Google 認證回調
        ]
        
        # 檢查是否為允許的路徑
        path_allowed = any(request.url.path.startswith(path) for path in allowed_paths)
        
        # 檢查是否為寫入操作
        is_write_operation = request.method in ["POST", "PUT", "PATCH", "DELETE"]
        
        # 如果是寫入操作且不在允許列表中，返回維護模式回應
        if is_write_operation and not path_allowed:
            return get_maintenance_response()
    
    # 正常處理請求
    response = await call_next(request)
    return response

# =================================
# 背景任務：自動排程爬蟲
# =================================
"""
使用獨立執行緒執行定期任務，避免阻塞主應用程式
每 10 分鐘自動爬取並更新醫院排程資訊
"""
import threading
import time
from routers.schedule import refresh_schedule

def schedule_loop():
    """
    排程爬蟲的主迴圈
    定期執行排程刷新任務，並處理可能的異常
    """
    while True:
        try:
            logger.info("開始執行排程爬蟲...")
            refresh_schedule()  # 執行排程刷新
            logger.info("排程爬蟲執行完成")
        except Exception as e:
            logger.error(f"自動排班爬蟲錯誤：{e}")
        time.sleep(SCHEDULE_REFRESH_INTERVAL)   # 等待下次執行

# 啟動背景排程爬蟲 (daemon=True 表示主程式結束時此執行緒也會結束)
threading.Thread(target=schedule_loop, daemon=True).start()
logger.info("背景排程爬蟲已啟動")
