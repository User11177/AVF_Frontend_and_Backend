from fastapi import APIRouter
from db import get_db

router = APIRouter()

# 取得健康資訊
@router.get("/health-info")
def get_health_info():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, title, content, updated_at FROM announcements  ORDER BY updated_at DESC")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return {"success": True, "data": rows} 