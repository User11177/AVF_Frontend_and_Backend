from fastapi import APIRouter, HTTPException, Depends
from models import AnnouncementCreate, AnnouncementUpdate
from db import get_db
from utils import get_current_user

router = APIRouter()

# 取得公告列表
@router.get("/api/announcements")
def get_announcements():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
SELECT a.id, a.title, a.content, a.published_at, u.full_name AS publisher
FROM announcements a LEFT JOIN users u ON a.publisher_id = u.id
ORDER BY a.published_at DESC
""")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return {"success": True, "data": rows}

# 新增公告
@router.post("/api/announcements")
def create_announcement(payload: AnnouncementCreate, user=Depends(get_current_user())):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO announcements (title, content, publisher_id) VALUES (%s, %s, %s)",
        (payload.title, payload.content, payload.publisher_id)
    )
    conn.commit()
    cursor.close()
    conn.close()
    return {"success": True, "message": "公告已新增"}

# 編輯公告
@router.put("/api/announcements/{announcement_id}")
def update_announcement(announcement_id: int, payload: AnnouncementUpdate, user=Depends(get_current_user())):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE announcements SET title=%s, content=%s WHERE id=%s",
        (payload.title, payload.content, announcement_id)
    )
    conn.commit()
    cursor.close()
    conn.close()
    return {"success": True, "message": "公告已更新"}

# 刪除公告
@router.delete("/api/announcements/{announcement_id}")
def delete_announcement(announcement_id: int, user=Depends(get_current_user())):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM announcements WHERE id=%s", (announcement_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return {"success": True, "message": "公告已刪除"} 