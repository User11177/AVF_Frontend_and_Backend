from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse
from loguru import logger
import os
from dotenv import load_dotenv
load_dotenv()

# ====== FastAPI app 初始化 ======
app = FastAPI()

# ====== CORS 設定 ======
from config import ALLOWED_ORIGINS, RATELIMIT_DEFAULT, SCHEDULE_REFRESH_INTERVAL
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ====== Rate Limiting ======
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    return JSONResponse(status_code=429, content={"success": False, "message": "Too Many Requests"})

# ====== Loguru 日誌 ======
logger.add("logs/app.log", rotation="1 week", serialize=True)

# ====== Router 匯入與掛載 ======
from routers import auth, users, patient, schedule, announcement, health_info, predict

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(patient.router, prefix="/api")
app.include_router(schedule.router, prefix="/api")
app.include_router(announcement.router, prefix="/api")
app.include_router(health_info.router, prefix="/api")
app.include_router(predict.router)

# ====== 自動排班爬蟲（每 10 分鐘） ======
import threading
import time
from routers.schedule import refresh_schedule

def schedule_loop():
    while True:
        try:
            refresh_schedule()
        except Exception as e:
            print("自動排班爬蟲錯誤：", e)
        time.sleep(SCHEDULE_REFRESH_INTERVAL)   

threading.Thread(target=schedule_loop, daemon=True).start()
