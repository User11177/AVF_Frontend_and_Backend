#!/usr/bin/env python3
# 測試聊天室創建功能

from db import get_db

def main():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    print('=== 檢查病患 ID 23 的用戶資訊 ===')
    cursor.execute('SELECT id, full_name, role FROM users WHERE id = 23')
    user = cursor.fetchone()
    if user:
        print(f'用戶 ID: {user["id"]}, 姓名: {user["full_name"]}, 角色: {user["role"]}')
    else:
        print('用戶 ID 23 不存在')
        return

    print('\n=== 檢查所有聊天室 ===')
    cursor.execute('SELECT cr.*, u.full_name FROM chat_rooms cr JOIN users u ON cr.patient_id = u.id ORDER BY cr.id')
    all_rooms = cursor.fetchall()
    if all_rooms:
        for room in all_rooms:
            print(f'聊天室 ID: {room["id"]}, 病患 ID: {room["patient_id"]}, 病患姓名: {room["full_name"]}, 標題: {room["title"]}, 狀態: {room["status"]}')
    else:
        print('沒有聊天室')

    print('\n=== 測試創建聊天室 ===')
    try:
        # 為病患 ID 23 創建聊天室
        cursor.execute("""
            INSERT INTO chat_rooms (patient_id, title, status) 
            VALUES (23, '蕭LH的諮詢', 'active')
        """)
        room_id = cursor.lastrowid
        conn.commit()
        print(f'成功創建聊天室，ID: {room_id}')
        
        # 驗證聊天室
        cursor.execute('SELECT * FROM chat_rooms WHERE id = %s', (room_id,))
        new_room = cursor.fetchone()
        if new_room:
            print(f'新聊天室詳情: {new_room}')
        else:
            print('無法找到新創建的聊天室')
            
    except Exception as e:
        print(f'創建聊天室失敗: {e}')
        conn.rollback()

    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
