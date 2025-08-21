# chat.py
# 客服式聊天室路由 - 病患提問，所有醫師可回答

from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from db import get_db
from utils import get_current_user, decode_token
from datetime import datetime
from typing import List, Dict
import json
from .websocket import WebSocketService, manager

router = APIRouter()

# 創建或取得病患聊天室
@router.post("/api/chat/create-or-get")
def create_or_get_patient_chat(payload: dict = None, user=Depends(get_current_user())):
    """
    為病患創建或取得聊天室
    - 病患：創建或取得自己的聊天室
    - 醫師：為指定病患創建或取得聊天室
    - 每個病患只有一個聊天室
    - 所有醫師都可以看到和回答
    """
    user_id = user['user_id']
    user_role = user['role']
    
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        if user_role == 'patient':
            # 病患：創建或取得自己的聊天室
            patient_id = user_id
            
        elif user_role == 'doctor':
            # 醫師：為指定病患創建或取得聊天室
            if not payload or not payload.get('patient_id'):
                raise HTTPException(status_code=400, detail="醫師需要指定病患ID")
            
            patient_id = payload.get('patient_id')
            
            # 驗證病患是否存在
            cursor.execute("SELECT id FROM users WHERE id = %s AND role = 'patient'", (patient_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="找不到指定的病患")
                
        else:
            raise HTTPException(status_code=403, detail="權限不足")
        
        # 檢查是否已有聊天室
        cursor.execute("""
            SELECT cr.*, u.full_name as patient_name
            FROM chat_rooms cr
            JOIN users u ON cr.patient_id = u.id
            WHERE cr.patient_id = %s
        """, (patient_id,))
        
        existing_room = cursor.fetchone()
        
        if existing_room:
            cursor.close()
            conn.close()
            return {
                "success": True,
                "chat_room": existing_room,
                "message": "取得現有聊天室"
            }
        
        # 創建新聊天室
        # 取得病患姓名作為標題
        cursor.execute("SELECT full_name FROM users WHERE id = %s", (patient_id,))
        patient = cursor.fetchone()
        patient_name = patient['full_name'] if patient else f"病患 {patient_id}"
        
        print(f"[DEBUG] 創建聊天室，病患ID: {patient_id}, 病患姓名: {patient_name}")
        
        cursor.execute("""
            INSERT INTO chat_rooms (patient_id, title, status) 
            VALUES (%s, %s, 'active')
        """, (patient_id, f"{patient_name}的諮詢"))
        
        room_id = cursor.lastrowid
        print(f"[DEBUG] 聊天室創建成功，ID: {room_id}")
        
        # 提交事務
        conn.commit()
        
        # 取得完整聊天室資訊
        cursor.execute("""
            SELECT cr.*, u.full_name as patient_name
            FROM chat_rooms cr
            JOIN users u ON cr.patient_id = u.id
            WHERE cr.id = %s
        """, (room_id,))
        
        new_room = cursor.fetchone()
        print(f"[DEBUG] 新聊天室資訊: {new_room}")
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "chat_room": new_room,
            "message": "聊天室創建成功"
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}

# 取得聊天室列表
@router.get("/api/chat/rooms")
def get_chat_rooms(user=Depends(get_current_user())):
    """
    取得聊天室列表
    - 病患：只能看到自己的聊天室
    - 醫師：可以看到所有活躍的聊天室
    """
    user_id = user['user_id']
    user_role = user['role']
    
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        if user_role == 'patient':
            # 病患只能看到自己的聊天室
            cursor.execute("""
                SELECT 
                    cr.*,
                    u.full_name as patient_name,
                    (SELECT COUNT(*) FROM chat_messages cm 
                     WHERE cm.chat_room_id = cr.id 
                     AND cm.sender_role = 'doctor' 
                     AND cm.is_read = FALSE) as unread_count,
                    (SELECT cm.content FROM chat_messages cm 
                     WHERE cm.chat_room_id = cr.id 
                     ORDER BY cm.created_at DESC LIMIT 1) as last_message,
                    (SELECT cm.created_at FROM chat_messages cm 
                     WHERE cm.chat_room_id = cr.id 
                     ORDER BY cm.created_at DESC LIMIT 1) as last_message_time
                FROM chat_rooms cr
                JOIN users u ON cr.patient_id = u.id
                WHERE cr.patient_id = %s AND cr.status = 'active'
                ORDER BY cr.updated_at DESC
            """, (user_id,))
            
        elif user_role == 'doctor':
            # 醫師可以看到所有活躍的聊天室
            cursor.execute("""
                SELECT 
                    cr.*,
                    u.full_name as patient_name,
                    u.phone as patient_phone,
                    u.mrn as patient_mrn,
                    (SELECT COUNT(*) FROM chat_messages cm 
                     WHERE cm.chat_room_id = cr.id 
                     AND cm.sender_role = 'patient' 
                     AND cm.is_read = FALSE) as unread_count,
                    (SELECT cm.content FROM chat_messages cm 
                     WHERE cm.chat_room_id = cr.id 
                     ORDER BY cm.created_at DESC LIMIT 1) as last_message,
                    (SELECT cm.created_at FROM chat_messages cm 
                     WHERE cm.chat_room_id = cr.id 
                     ORDER BY cm.created_at DESC LIMIT 1) as last_message_time,
                    (SELECT cm.sender_role FROM chat_messages cm 
                     WHERE cm.chat_room_id = cr.id 
                     ORDER BY cm.created_at DESC LIMIT 1) as last_sender_role
                FROM chat_rooms cr
                JOIN users u ON cr.patient_id = u.id
                WHERE cr.status = 'active'
                ORDER BY 
                    unread_count DESC,  -- 未讀優先
                    cr.updated_at DESC  -- 最新活動優先
            """)
            
        else:
            raise HTTPException(status_code=403, detail="權限不足")
        
        rooms = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return rooms
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 取得聊天室訊息
@router.get("/api/chat/messages/{chat_room_id}")
def get_chat_messages(chat_room_id: int, user=Depends(get_current_user())):
    """
    取得聊天室訊息
    - 病患：只能看自己聊天室的訊息
    - 醫師：可以看所有聊天室的訊息
    """
    user_id = user['user_id']
    user_role = user['role']
    
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # 檢查權限
        if user_role == 'patient':
            cursor.execute("""
                SELECT id FROM chat_rooms 
                WHERE id = %s AND patient_id = %s
            """, (chat_room_id, user_id))
            
            if not cursor.fetchone():
                raise HTTPException(status_code=403, detail="無權限查看此聊天室")
        
        # 取得訊息
        cursor.execute("""
            SELECT 
                cm.*,
                u.full_name as sender_name,
                u.role as sender_user_role
            FROM chat_messages cm
            JOIN users u ON cm.sender_id = u.id
            WHERE cm.chat_room_id = %s
            ORDER BY cm.created_at ASC
        """, (chat_room_id,))
        
        messages = cursor.fetchall()
        
        # 標記醫師的訊息為已讀（如果是病患查看）
        if user_role == 'patient':
            cursor.execute("""
                UPDATE chat_messages 
                SET is_read = TRUE 
                WHERE chat_room_id = %s 
                AND sender_role = 'doctor' 
                AND is_read = FALSE
            """, (chat_room_id,))
            conn.commit()
            
        # 標記病患的訊息為已讀（如果是醫師查看）
        elif user_role == 'doctor':
            cursor.execute("""
                UPDATE chat_messages 
                SET is_read = TRUE 
                WHERE chat_room_id = %s 
                AND sender_role = 'patient' 
                AND is_read = FALSE
            """, (chat_room_id,))
            conn.commit()
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "messages": messages
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 發送訊息
@router.post("/api/chat/send")
async def send_message(payload: dict, user=Depends(get_current_user())):
    """
    發送聊天訊息
    - 病患：只能在自己的聊天室發訊息
    - 醫師：可以在任何聊天室回答
    """
    user_id = user['user_id']
    user_role = user['role']
    
    chat_room_id = payload.get('chat_room_id')
    content = payload.get('content')
    
    if not chat_room_id or not content:
        raise HTTPException(status_code=400, detail="聊天室ID和內容不能為空")
    
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # 檢查聊天室權限
        if user_role == 'patient':
            cursor.execute("""
                SELECT id FROM chat_rooms 
                WHERE id = %s AND patient_id = %s AND status = 'active'
            """, (chat_room_id, user_id))
            
            if not cursor.fetchone():
                raise HTTPException(status_code=403, detail="無權限在此聊天室發言")
        
        elif user_role == 'doctor':
            cursor.execute("""
                SELECT id FROM chat_rooms 
                WHERE id = %s AND status = 'active'
            """, (chat_room_id,))
            
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="聊天室不存在或已關閉")
        
        else:
            raise HTTPException(status_code=403, detail="權限不足")
        
        # 插入訊息
        cursor.execute("""
            INSERT INTO chat_messages (chat_room_id, sender_id, sender_role, content) 
            VALUES (%s, %s, %s, %s)
        """, (chat_room_id, user_id, user_role, content))
        
        message_id = cursor.lastrowid
        
        # 更新聊天室的最後活動時間
        cursor.execute("""
            UPDATE chat_rooms 
            SET updated_at = CURRENT_TIMESTAMP 
            WHERE id = %s
        """, (chat_room_id,))
        
        conn.commit()
        
        # 取得完整訊息資訊
        cursor.execute("""
            SELECT 
                cm.*,
                u.full_name as sender_name,
                u.role as sender_user_role
            FROM chat_messages cm
            JOIN users u ON cm.sender_id = u.id
            WHERE cm.id = %s
        """, (message_id,))
        
        message = cursor.fetchone()
        cursor.close()
        conn.close()
        
        # 發送即時訊息給其他用戶
        await WebSocketService.notify_new_message(chat_room_id, message, user_id)
        
        return {
            "success": True,
            "message": message
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 取得聊天室詳情
@router.get("/api/chat/room/{chat_room_id}")
def get_chat_room_detail(chat_room_id: int, user=Depends(get_current_user())):
    """
    取得聊天室詳細資訊
    """
    user_id = user['user_id']
    user_role = user['role']
    
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # 檢查權限
        if user_role == 'patient':
            cursor.execute("""
                SELECT cr.*, u.full_name as patient_name
                FROM chat_rooms cr
                JOIN users u ON cr.patient_id = u.id
                WHERE cr.id = %s AND cr.patient_id = %s
            """, (chat_room_id, user_id))
        
        elif user_role == 'doctor':
            cursor.execute("""
                SELECT cr.*, u.full_name as patient_name, u.phone as patient_phone, u.mrn as patient_mrn
                FROM chat_rooms cr
                JOIN users u ON cr.patient_id = u.id
                WHERE cr.id = %s
            """, (chat_room_id,))
        
        else:
            raise HTTPException(status_code=403, detail="權限不足")
        
        room = cursor.fetchone()
        
        if not room:
            raise HTTPException(status_code=404, detail="聊天室不存在或無權限查看")
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "room": room
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# WebSocket 端點
@router.websocket("/ws/chat/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
                await WebSocketService.handle_message(user_id, message_data)
            except json.JSONDecodeError:
                # 處理非 JSON 訊息（如心跳包）
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(user_id)