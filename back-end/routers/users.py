from fastapi import APIRouter, HTTPException, Depends, Request
from models import CreateUserPayload, UpdateUserPayload
from db import get_db
from utils import hash_password, get_current_user
import mysql.connector

router = APIRouter()

# 取得當前用戶角色
@router.get("/api/user/current-role")
def get_current_user_role(user=Depends(get_current_user())):
    """取得當前登入用戶的角色信息"""
    return {
        "user_id": user.get('user_id'),
        "role": user.get('role'),
        "success": True
    }

# 取得所有帳號資料
@router.get("/api/users")
def get_all_users(user=Depends(get_current_user())):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users")
    users = cursor.fetchall()
    cursor.close()
    conn.close()
    return users

# 查詢單一帳號
@router.get("/api/users/{user_id}")
def get_user(user_id: int, user=Depends(get_current_user())):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    if not user:
        raise HTTPException(status_code=404, detail="找不到帳號")
    return user

# 新增帳號
@router.post("/api/users")
def create_user(request: Request, payload: CreateUserPayload, user=Depends(get_current_user())):
    conn = get_db()
    cursor = conn.cursor()
    try:
        # 新增: 處理密碼
        password = getattr(payload, 'password', None)
        password_hash = hash_password(password) if password else None
        cursor.execute("""
            INSERT INTO users (full_name, id_number, mrn, email, phone, birthdate, address, emergency_name, emergency_phone, email_verified, phone_verified, role, password_hash)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            payload.full_name, payload.id_number, getattr(payload, 'mrn', None), payload.email, payload.phone,
            getattr(payload, 'birthdate', None), getattr(payload, 'address', None),
            getattr(payload, 'emergency_name', None), getattr(payload, 'emergency_phone', None),
            getattr(payload, 'email_verified', 0), getattr(payload, 'phone_verified', 0),
            payload.role, password_hash
        ))
        conn.commit()
    except mysql.connector.IntegrityError as e:
        if "Duplicate entry" in str(e):
            raise HTTPException(status_code=409, detail="手機或 Email 已存在")
        else:
            raise
    finally:
        cursor.close()
        conn.close()
    return {"message": "帳號建立成功"}

# 編輯帳號
@router.put("/api/users/{user_id}")
def update_user(request: Request, user_id: int, payload: UpdateUserPayload, user=Depends(get_current_user())):
    conn = get_db()
    cursor = conn.cursor()
    updates, params = [], []
    if payload.full_name: updates.append('full_name=%s'); params.append(payload.full_name)
    if payload.id_number: updates.append('id_number=%s'); params.append(payload.id_number)
    if payload.mrn: updates.append('mrn=%s'); params.append(payload.mrn)
    if payload.email:    updates.append('email=%s'); params.append(payload.email)
    if payload.phone:    updates.append('phone=%s'); params.append(payload.phone)
    if payload.birthdate: updates.append('birthdate=%s'); params.append(payload.birthdate)
    if payload.address:   updates.append('address=%s'); params.append(payload.address)
    if payload.emergency_name: updates.append('emergency_name=%s'); params.append(payload.emergency_name)
    if payload.emergency_phone: updates.append('emergency_phone=%s'); params.append(payload.emergency_phone)
    if hasattr(payload, 'email_verified'): updates.append('email_verified=%s'); params.append(payload.email_verified)
    if hasattr(payload, 'phone_verified'): updates.append('phone_verified=%s'); params.append(payload.phone_verified)
    if payload.role: updates.append('role=%s'); params.append(payload.role)
    if hasattr(payload, 'password') and payload.password:
        updates.append('password_hash=%s'); params.append(hash_password(payload.password))
    if updates:
        params.append(user_id)
        cursor.execute(f'UPDATE users SET {", ".join(updates)} WHERE id=%s', tuple(params))
    conn.commit()
    cursor.close()
    conn.close()
    return {"message": "帳號已更新"}

# 刪除帳號
@router.delete("/api/users/{user_id}")
def delete_user(request: Request, user_id: int, user=Depends(get_current_user())):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
    if cursor.rowcount == 0:
        conn.commit()
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="找不到帳號")
    conn.commit()
    cursor.close()
    conn.close()
    return {"message": "帳號已刪除"}

# 查詢個人資料
@router.get('/api/user/profile')
def get_profile(id: int = None, phone: str = None, email: str = None, user=Depends(get_current_user())):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    user = None
    if id:
        cursor.execute('SELECT * FROM users WHERE id=%s', (id,))
        user = cursor.fetchone()
    elif phone:
        cursor.execute('SELECT * FROM users WHERE phone=%s', (phone,))
        user = cursor.fetchone()
    elif email:
        cursor.execute('SELECT * FROM users WHERE email=%s', (email,))
        user = cursor.fetchone()
    else:
        cursor.close()
        conn.close()
        raise HTTPException(400, '請提供 id、phone 或 email')
    cursor.close()
    conn.close()
    if not user:
        raise HTTPException(404, '找不到用戶')
    return {'user': user}

# 編輯個人資料
@router.post('/api/user/profile/update')
async def update_profile(request: Request, user=Depends(get_current_user())):
    data = await request.json()
    id = data.get('id')
    phone = data.get('phone')
    email = data.get('email')
    full_name = data.get('full_name')
    id_number = data.get('id_number')
    new_phone = data.get('new_phone')
    birthdate = data.get('birthdate')
    address = data.get('address')
    emergency_name = data.get('emergency_name')
    emergency_phone = data.get('emergency_phone')
    email_verified = data.get('email_verified')
    phone_verified = data.get('phone_verified')
    print('[update_profile] 收到 id:', id, 'phone:', phone, 'email:', email)
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    user = None
    if id:
        cursor.execute('SELECT * FROM users WHERE id=%s', (id,))
        user = cursor.fetchone()
    elif phone:
        cursor.execute('SELECT * FROM users WHERE phone=%s', (phone,))
        user = cursor.fetchone()
    elif email:
        cursor.execute('SELECT * FROM users WHERE email=%s', (email,))
        user = cursor.fetchone()
    if not user:
        cursor.close()
        conn.close()
        raise HTTPException(404, '找不到用戶')
    user_id = user['id']
    updates, params = [], []
    if id_number: updates.append('id_number=%s'); params.append(id_number)
    if full_name: updates.append('full_name=%s'); params.append(full_name)
    if email:    updates.append('email=%s'); params.append(email)
    mrn = data.get('mrn')
    if mrn: updates.append('mrn=%s'); params.append(mrn)
    if new_phone:
        cursor.execute('SELECT id FROM users WHERE phone=%s AND id!=%s', (new_phone, user_id))
        if cursor.fetchone():
            cursor.close(); conn.close()
            raise HTTPException(409, '新電話已被其他帳號使用')
    if email:
        cursor.execute('SELECT id FROM users WHERE email=%s AND id!=%s', (email, user_id))
        if cursor.fetchone():
            cursor.close(); conn.close()
            raise HTTPException(409, '新Email已被其他帳號使用')
    if new_phone: updates.append('phone=%s'); params.append(new_phone)
    if birthdate:  updates.append('birthdate=%s'); params.append(birthdate)
    if address:   updates.append('address=%s'); params.append(address)
    if emergency_name: updates.append('emergency_name=%s'); params.append(emergency_name)
    if emergency_phone: updates.append('emergency_phone=%s'); params.append(emergency_phone)
    if email_verified is not None: updates.append('email_verified=%s'); params.append(email_verified)
    if phone_verified is not None: updates.append('phone_verified=%s'); params.append(phone_verified)
    if updates:
        params.append(user_id)
        cursor.execute(f'UPDATE users SET {", ".join(updates)} WHERE id=%s', tuple(params))
    conn.commit()
    cursor.close()
    conn.close()
    return {'success': True, 'message': '個資已更新'}
