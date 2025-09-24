# admin.py
# 管理員專用 API 路由
# 提供系統維護、監控、統計等管理功能

from __future__ import annotations
import os
import json
import time
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from loguru import logger

# 導入認證和資料庫模組
from utils import get_current_user, verify_admin_role
from db import get_db
# 導入模型
from models import MaintenanceToggle, SystemHealthStatus, UserStatistics, ErrorLogItem, ErrorLogsData, MaintenanceStatus

# 創建路由器
router = APIRouter()

# ============================================================================
# 注意：所有模型定義已移至 models.py 以避免重複定義
# ============================================================================

# ============================================================================
# 全局變數：維護模式狀態
# ============================================================================
MAINTENANCE_FILE = "maintenance.json"
maintenance_status = {"enabled": False, "last_updated": None}

def load_maintenance_status():
    """從檔案載入維護模式狀態"""
    global maintenance_status
    try:
        if os.path.exists(MAINTENANCE_FILE):
            with open(MAINTENANCE_FILE, 'r', encoding='utf-8') as f:
                maintenance_status = json.load(f)
    except Exception as e:
        logger.error(f"載入維護模式狀態失敗: {e}")

def save_maintenance_status():
    """儲存維護模式狀態到檔案"""
    try:
        with open(MAINTENANCE_FILE, 'w', encoding='utf-8') as f:
            json.dump(maintenance_status, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"儲存維護模式狀態失敗: {e}")

# 初始化時載入維護模式狀態
load_maintenance_status()

# ============================================================================
# 權限驗證中間件
# ============================================================================

async def verify_admin(current_user: dict = Depends(verify_admin_role)):
    """驗證用戶是否為管理員"""
    return current_user

# ============================================================================
# 維護模式 API
# ============================================================================

@router.get("/api/admin/maintenance-status")
async def get_maintenance_status(admin_user: dict = Depends(verify_admin)):
    """
    獲取當前維護模式狀態
    """
    try:
        return {
            "success": True,
            "maintenance": maintenance_status.get("enabled", False),
            "last_updated": maintenance_status.get("last_updated")
        }
    except Exception as e:
        logger.error(f"獲取維護模式狀態失敗: {e}")
        raise HTTPException(status_code=500, detail="內部伺服器錯誤")

@router.post("/api/admin/maintenance")
async def toggle_maintenance_mode(
    request: MaintenanceToggle,
    admin_user: dict = Depends(verify_admin)
):
    """
    切換維護模式狀態
    - 開啟時：全站進入唯讀模式
    - 關閉時：恢復正常運行
    """
    try:
        global maintenance_status
        maintenance_status = {
            "enabled": request.maintenance,
            "last_updated": datetime.now().isoformat(),
            "updated_by": admin_user.get("id")
        }
        save_maintenance_status()
        
        action = "開啟" if request.maintenance else "關閉"
        logger.info(f"管理員 {admin_user.get('id')} {action}了維護模式")
        
        return {
            "success": True,
            "message": f"維護模式已{action}",
            "maintenance": request.maintenance
        }
    except Exception as e:
        logger.error(f"切換維護模式失敗: {e}")
        raise HTTPException(status_code=500, detail="操作失敗")

# ============================================================================
# 系統健康檢查 API
# ============================================================================

@router.get("/api/admin/health")
async def get_system_health(admin_user: dict = Depends(verify_admin)):
    """
    獲取系統健康狀態
    檢查：API服務、資料庫連線、檔案上傳目錄
    """
    health_status = {
        "api": True,  # 能執行到這裡就表示 API 正常
        "db": False,
        "uploads_writable": False
    }
    
    try:
        # 測試資料庫連線
        try:
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            health_status["db"] = result is not None
            conn.close()
        except Exception as e:
            logger.error(f"資料庫健康檢查失敗: {e}")
            health_status["db"] = False
        
        # 測試檔案上傳目錄可寫性
        try:
            uploads_dir = "uploads"
            if not os.path.exists(uploads_dir):
                os.makedirs(uploads_dir)
            
            test_file = os.path.join(uploads_dir, "health_check.tmp")
            with open(test_file, 'w') as f:
                f.write("health_check")
            
            if os.path.exists(test_file):
                os.remove(test_file)
                health_status["uploads_writable"] = True
        except Exception as e:
            logger.error(f"檔案系統健康檢查失敗: {e}")
            health_status["uploads_writable"] = False
        
        return {
            "success": True,
            "health": health_status,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"系統健康檢查失敗: {e}")
        raise HTTPException(status_code=500, detail="健康檢查失敗")

# ============================================================================
# 用戶統計 API
# ============================================================================

@router.get("/api/admin/user-stats")
async def get_user_statistics(admin_user: dict = Depends(verify_admin)):
    """
    獲取用戶統計資訊
    統計各角色的用戶數量
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # 統計各角色用戶數量
        cursor.execute("""
            SELECT role, COUNT(*) as count 
            FROM users 
            WHERE role IS NOT NULL 
            GROUP BY role
        """)
        role_counts = dict(cursor.fetchall())
        
        stats = {
            "admin_count": role_counts.get("admin", 0),
            "doctor_count": role_counts.get("doctor", 0),
            "patient_count": role_counts.get("patient", 0),
            "total_users": sum(role_counts.values()),
            "last_updated": datetime.now().isoformat()
        }
        
        conn.close()
        
        return {
            "success": True,
            "stats": stats
        }
            
    except Exception as e:
        logger.error(f"獲取用戶統計失敗: {e}")
        raise HTTPException(status_code=500, detail="統計資料載入失敗")

# ============================================================================
# 錯誤日誌統計 API
# ============================================================================

@router.get("/api/admin/error-logs")
async def get_error_logs(admin_user: dict = Depends(verify_admin)):
    """
    獲取錯誤日誌統計
    分析過去24小時內的錯誤熱點
    """
    try:
        # 這裡使用模擬資料，實際實現會從日誌文件或資料庫讀取
        # 讀取 logs 目錄中的日誌文件
        logs_dir = "logs"
        if not os.path.exists(logs_dir):
            return {
                "success": True,
                "logs": {
                    "total_errors": 0,
                    "top_errors": [],
                    "last_updated": datetime.now().isoformat()
                }
            }
        
        # 分析日誌文件 (簡化實現)
        error_stats = {}
        total_errors = 0
        
        # 掃描過去24小時的日誌
        now = datetime.now()
        cutoff_time = now - timedelta(hours=24)
        
        try:
            # 讀取最新的日誌文件
            log_files = [f for f in os.listdir(logs_dir) if f.endswith('.log')]
            log_files.sort(reverse=True)  # 最新的在前
            
            for log_file in log_files[:5]:  # 只檢查最新的5個日誌文件
                log_path = os.path.join(logs_dir, log_file)
                try:
                    with open(log_path, 'r', encoding='utf-8') as f:
                        for line in f:
                            try:
                                log_entry = json.loads(line.strip())
                                log_time = datetime.fromisoformat(
                                    log_entry.get('time', '').replace('Z', '+00:00').split('.')[0]
                                )
                                
                                if log_time >= cutoff_time and log_entry.get('level') in ['ERROR', 'CRITICAL']:
                                    error_code = f"{log_entry.get('level', 'ERROR')}"
                                    message = log_entry.get('message', '')
                                    
                                    # 嘗試從訊息中提取HTTP狀態碼
                                    if '500' in message:
                                        error_code = "HTTP_500"
                                    elif '404' in message:
                                        error_code = "HTTP_404"
                                    elif '403' in message:
                                        error_code = "HTTP_403"
                                    elif '401' in message:
                                        error_code = "HTTP_401"
                                    elif 'database' in message.lower():
                                        error_code = "DB_ERROR"
                                    elif 'connection' in message.lower():
                                        error_code = "CONNECTION_ERROR"
                                    
                                    if error_code not in error_stats:
                                        error_stats[error_code] = {
                                            "count": 0,
                                            "last_occurred": log_time.isoformat(),
                                            "description": message[:100] + "..." if len(message) > 100 else message
                                        }
                                    
                                    error_stats[error_code]["count"] += 1
                                    if log_time.isoformat() > error_stats[error_code]["last_occurred"]:
                                        error_stats[error_code]["last_occurred"] = log_time.isoformat()
                                    
                                    total_errors += 1
                                    
                            except (json.JSONDecodeError, ValueError, KeyError):
                                continue  # 跳過無法解析的行
                except Exception:
                    continue  # 跳過無法讀取的文件
                    
        except Exception as e:
            logger.error(f"讀取日誌文件失敗: {e}")
        
        # 轉換為列表並按次數排序
        top_errors = []
        for error_code, stats in error_stats.items():
            top_errors.append({
                "error_code": error_code,
                "count": stats["count"],
                "last_occurred": stats["last_occurred"],
                "description": stats.get("description", "")
            })
        
        top_errors.sort(key=lambda x: x["count"], reverse=True)
        top_errors = top_errors[:10]  # 只取前10個
        
        return {
            "success": True,
            "logs": {
                "total_errors": total_errors,
                "top_errors": top_errors,
                "last_updated": datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"獲取錯誤日誌失敗: {e}")
        raise HTTPException(status_code=500, detail="日誌分析失敗")

# ============================================================================
# CSV 匯出功能
# ============================================================================

@router.post("/api/admin/export-error-logs")
async def export_error_logs_csv(admin_user: dict = Depends(verify_admin)):
    """
    匯出錯誤日誌為 CSV 格式
    """
    try:
        # 重新獲取錯誤日誌資料
        error_logs_response = await get_error_logs(admin_user)
        if not error_logs_response.get("success"):
            raise HTTPException(status_code=500, detail="無法獲取日誌資料")
        
        logs_data = error_logs_response["logs"]
        top_errors = logs_data.get("top_errors", [])
        
        if not top_errors:
            raise HTTPException(status_code=404, detail="沒有可匯出的錯誤記錄")
        
        # 生成 CSV 內容
        csv_header = "錯誤代碼,發生次數,最後發生時間,描述\n"
        csv_content = csv_header
        
        for error in top_errors:
            # 處理CSV中的特殊字符
            description = error.get("description", "").replace('"', '""').replace('\n', ' ')
            csv_content += f'"{error["error_code"]}",{error["count"]},"{error["last_occurred"]}","{description}"\n'
        
        # 生成檔案名稱
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"error_logs_{timestamp}.csv"
        
        # 在實際實現中，這裡會儲存檔案並提供下載連結
        # 由於這是示例，我們只回傳成功訊息
        logger.info(f"管理員 {admin_user.get('id')} 匯出了錯誤日誌")
        
        return {
            "success": True,
            "message": "CSV 檔案匯出成功",
            "filename": filename,
            "records_count": len(top_errors)
        }
        
    except Exception as e:
        logger.error(f"匯出錯誤日誌失敗: {e}")
        raise HTTPException(status_code=500, detail="匯出失敗")

# ============================================================================
# 日誌清理功能
# ============================================================================

@router.post("/api/admin/clear-old-logs")
async def clear_old_logs(admin_user: dict = Depends(verify_admin)):
    """
    清除7天前的舊日誌記錄
    """
    try:
        logs_dir = "logs"
        if not os.path.exists(logs_dir):
            return {
                "success": True,
                "message": "日誌目錄不存在",
                "deleted_count": 0
            }
        
        cutoff_date = datetime.now() - timedelta(days=7)
        deleted_count = 0
        
        # 掃描日誌文件
        for filename in os.listdir(logs_dir):
            if not filename.endswith('.log'):
                continue
                
            file_path = os.path.join(logs_dir, filename)
            try:
                # 檢查文件修改時間
                file_mtime = datetime.fromtimestamp(os.path.getmtime(file_path))
                
                if file_mtime < cutoff_date:
                    os.remove(file_path)
                    deleted_count += 1
                    logger.info(f"已刪除舊日誌文件: {filename}")
                    
            except Exception as e:
                logger.error(f"刪除日誌文件 {filename} 失敗: {e}")
                continue
        
        logger.info(f"管理員 {admin_user.get('id')} 清理了 {deleted_count} 個舊日誌文件")
        
        return {
            "success": True,
            "message": f"成功清除 {deleted_count} 個舊日誌文件",
            "deleted_count": deleted_count
        }
        
    except Exception as e:
        logger.error(f"清理舊日誌失敗: {e}")
        raise HTTPException(status_code=500, detail="清理失敗")

# ============================================================================
# 維護模式中間件檢查函數
# ============================================================================

def is_maintenance_mode() -> bool:
    """檢查是否處於維護模式"""
    return maintenance_status.get("enabled", False)

def get_maintenance_response():
    """獲取維護模式回應"""
    return JSONResponse(
        status_code=503,
        content={
            "success": False,
            "message": "伺服器維護中，請稍後再試",
            "maintenance": True,
            "retry_after": "請稍後重試"
        }
    )
