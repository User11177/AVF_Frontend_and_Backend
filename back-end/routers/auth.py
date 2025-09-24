# auth.py
# 身份驗證路由器 - 處理用戶登入、註冊、密碼管理等功能
# 包含 OTP 驗證、JWT token 管理、密碼重設等安全機制

# 導入必要的模組
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from fastapi.responses import RedirectResponse, HTMLResponse
from db import get_db                    # 資料庫連線
from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI  # Google OAuth 設定
from utils import (                      # 工具函數
    gen_code, set_verify_code, check_verify_code,  # 驗證碼相關
    send_sms, send_email,                # 通訊服務
    create_access_token, create_refresh_token,     # JWT token 生成
    verify_sms, decode_token, get_current_user,    # 驗證相關
    hash_password, verify_password       # 密碼處理
)
import secrets
import requests
from models import (                     # 資料模型
    RegisterSMSPayload, VerifySMSPayload, SetPasswordPayload,
    LoginPayload, GoogleLoginPayload, ResetPasswordRequest,
    ResetPasswordVerifyPayload, ResetPasswordPayload
)

# 建立路由器實例
router = APIRouter()

# =================================
# OTP (一次性密碼) 驗證系統
# =================================

@router.post('/api/auth/request-otp',
    summary="OTP 驗證處理",
    description="統一處理 OTP 發送和驗證，支援多種模式",
    response_description="根據模式返回相應結果"
)
def request_otp(request: Request, payload: dict):
    """
    OTP 驗證處理 API - 統一處理發送驗證碼和驗證邏輯
    
    **支援模式**：
    1. **發送驗證碼**: 只提供 phone/email
    2. **註冊新用戶**: 提供 phone + code + password (電話號碼註冊)
    3. **驗證現有用戶**: 提供 phone/email + code + user_id (編輯個資時驗證)
    
    **參數**：
    - phone: 電話號碼 (與 email 二選一)
    - email: Email 地址 (與 phone 二選一)  
    - code: 驗證碼 (驗證時必填)
    - password: 密碼 (註冊時必填)
    - user_id: 用戶 ID (更新現有用戶時必填)
    
    **返回**：
    - 發送驗證碼: success + message
    - 註冊: success + token + refresh_token + user
    - 驗證: success + user + message
    """
    phone = payload.get('phone')
    email = payload.get('email')
    code = payload.get('code')
    password = payload.get('password')
    user_id = payload.get('user_id')
    
    # 驗證輸入：只能選擇一種驗證方式
    if (phone and email) or (not phone and not email):
        raise HTTPException(400, '請只填寫手機或 Email 其中一個')
    
    # 模式1: 只是發送驗證碼
    if not code:
        if phone:
            send_sms(phone)  # Twilio 會自動產生驗證碼
            print(f"[OTP] SMS 驗證碼已發送到: {phone}")
        if email:
            verification_code = gen_code()
            set_verify_code(f"email:{email}", verification_code)
            send_email(email, '驗證碼', f'您的驗證碼：{verification_code}')
            print(f"[OTP] Email 驗證碼已發送到: {email}")
        
        return {'success': True, 'message': '驗證碼已發送'}
    
    # 模式2 & 3: 驗證驗證碼
    # 首先驗證 OTP
    if phone:
        if not verify_sms(phone, code):
            raise HTTPException(400, '驗證碼錯誤或過期')
    elif email:
        key = f"email:{email}"
        if not check_verify_code(key, code):
            raise HTTPException(400, '驗證碼錯誤或過期')
    
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    try:
        if user_id:
            # 模式2: 更新現有用戶
            print(f"[request_otp] 更新現有用戶模式，用戶 ID: {user_id}")
            
            cursor.execute('SELECT * FROM users WHERE id=%s', (user_id,))
            user = cursor.fetchone()
            
            if not user:
                raise HTTPException(400, '找不到指定的用戶')
            
            # 更新用戶資料
            if phone:
                print(f"[request_otp] 更新用戶 {user_id} 的電話: {phone}")
                cursor.execute('UPDATE users SET phone=%s, phone_verified=TRUE WHERE id=%s', (phone, user_id))
            elif email:
                print(f"[request_otp] 更新用戶 {user_id} 的 Email: {email}")
                cursor.execute('UPDATE users SET email=%s, email_verified=TRUE WHERE id=%s', (email, user_id))
            
            conn.commit()
            
            # 重新查詢更新後的用戶資料
            cursor.execute('SELECT * FROM users WHERE id=%s', (user_id,))
            updated_user = cursor.fetchone()
            
            print(f"[request_otp] 現有用戶更新成功: {updated_user}")
            return {'success': True, 'user': updated_user, 'message': '驗證成功，資料已更新'}
            
        else:
            # 模式3: 創建新用戶（註冊流程）
            print("[request_otp] 註冊新用戶模式")
            
            if phone:
                # 電話號碼註冊必須提供密碼
                if not password:
                    raise HTTPException(400, '電話號碼註冊必須提供密碼')
                    
                cursor.execute('SELECT * FROM users WHERE phone=%s', (phone,))
                user = cursor.fetchone()
                
                if user:
                    # 用戶已存在，只更新驗證狀態
                    cursor.execute('UPDATE users SET phone_verified=TRUE WHERE phone=%s', (phone,))
                    conn.commit()
                    print(f"[request_otp] 現有用戶電話驗證成功: {user['id']}")
                else:
                    # 創建新用戶，包含密碼
                    password_hash = hash_password(password)
                    cursor.execute(
                        'INSERT INTO users (phone, phone_verified, password_hash, role) VALUES (%s, TRUE, %s, %s)', 
                        (phone, password_hash, 'patient')
                    )
                    conn.commit()
                    cursor.execute('SELECT * FROM users WHERE phone=%s', (phone,))
                    user = cursor.fetchone()
                    print(f"[request_otp] 新用戶註冊成功: {user['id']}, phone: {phone}")
                    
            elif email:
                # Email 註冊暫時不支援，因為主要透過 Google 登入
                cursor.execute('SELECT * FROM users WHERE email=%s', (email,))
                user = cursor.fetchone()
                if not user:
                    cursor.execute('INSERT INTO users (email, email_verified) VALUES (%s, TRUE)', (email,))
                    conn.commit()
                    cursor.execute('SELECT * FROM users WHERE email=%s', (email,))
                    user = cursor.fetchone()
                else:
                    cursor.execute('UPDATE users SET email_verified=TRUE WHERE email=%s', (email,))
                    conn.commit()
            
            # 產生 token
            token = create_access_token({'user_id': user['id'], 'role': user['role']})
            refresh_token = create_refresh_token({'user_id': user['id'], 'role': user['role']})
            
            print(f"[request_otp] 用戶註冊/驗證成功: {user}")
            return {'success': True, 'token': token, 'refresh_token': refresh_token, 'user': user}
            
    finally:
        cursor.close()
        conn.close()

@router.post('/api/auth/verify-and-update-contact',
    summary="驗證並更新聯絡方式",
    description="編輯個資時即時驗證並更新 Email 或電話號碼",
    response_description="返回更新後的用戶資訊"
)
def verify_and_update_contact(request: Request, payload: dict):
    """
    驗證並更新聯絡方式 API - 專門用於個人資料編輯
    
    **流程**：
    1. 用戶在編輯個資時變更 Email 或電話號碼
    2. 系統立即發送驗證碼到新的聯絡方式
    3. 用戶輸入驗證碼後，系統驗證並更新資料
    4. 返回更新後的用戶資訊
    
    **參數**：
    - user_id: 用戶 ID (必填)
    - phone: 新電話號碼 (與 email 二選一)
    - email: 新 Email 地址 (與 phone 二選一)
    - code: 驗證碼 (驗證時必填)
    
    **返回**：
    - 發送驗證碼: success + message
    - 驗證成功: success + user
    """
    user_id = payload.get('user_id')
    phone = payload.get('phone')
    email = payload.get('email')
    code = payload.get('code')
    
    if not user_id:
        raise HTTPException(400, '缺少用戶 ID')
        
    if (phone and email) or (not phone and not email):
        raise HTTPException(400, '請只填寫手機或 Email 其中一個')
    
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # 驗證用戶是否存在
        cursor.execute('SELECT * FROM users WHERE id=%s', (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(404, '用戶不存在')
        
        # 如果沒有提供驗證碼，則發送驗證碼
        if not code:
            if phone:
                send_sms(phone)
                print(f"[Update Contact] SMS 驗證碼已發送到: {phone}")
            elif email:
                verification_code = gen_code()
                set_verify_code(f"email:{email}", verification_code)
                send_email(email, '變更聯絡方式驗證碼', f'您的驗證碼：{verification_code}')
                print(f"[Update Contact] Email 驗證碼已發送到: {email}")
            
            return {'success': True, 'message': '驗證碼已發送'}
        
        # 驗證驗證碼
        if phone:
            if not verify_sms(phone, code):
                raise HTTPException(400, '驗證碼錯誤或過期')
        elif email:
            key = f"email:{email}"
            if not check_verify_code(key, code):
                raise HTTPException(400, '驗證碼錯誤或過期')
        
        # 更新用戶資料
        if phone:
            cursor.execute('UPDATE users SET phone=%s, phone_verified=TRUE WHERE id=%s', (phone, user_id))
            print(f"[Update Contact] 更新用戶 {user_id} 的電話: {phone}")
        elif email:
            cursor.execute('UPDATE users SET email=%s, email_verified=TRUE WHERE id=%s', (email, user_id))
            print(f"[Update Contact] 更新用戶 {user_id} 的 Email: {email}")
        
        conn.commit()
        
        # 重新查詢更新後的用戶資料
        cursor.execute('SELECT * FROM users WHERE id=%s', (user_id,))
        updated_user = cursor.fetchone()
        
        print(f"[Update Contact] 聯絡方式更新成功: {updated_user}")
        return {'success': True, 'user': updated_user, 'message': '聯絡方式更新成功'}
        
    finally:
        cursor.close()
        conn.close()

@router.post('/api/auth/verify-otp')
def verify_otp(request: Request, payload: dict):
    phone = payload.get('phone')
    email = payload.get('email')
    code = payload.get('code')
    update_existing_user_id = payload.get('update_existing_user_id')  # 新增：是否更新現有用戶
    
    print(f"[verify_otp] 收到完整 payload: {payload}")
    print(f"[verify_otp] update_existing_user_id: {update_existing_user_id}")
    
    if (phone and email) or (not phone and not email):
        raise HTTPException(400, '請只填寫手機或 Email 其中一個')
    
    # 驗證 OTP
    if phone:
        if not verify_sms(phone, code):
            print(f"[verify_otp] Twilio 驗證失敗 phone={phone}, code={code}")
            raise HTTPException(400, '驗證碼錯誤或過期')
    if email:
        key = f"email:{email}"
        if not check_verify_code(key, code):
            print(f"[verify_otp] 驗證失敗 key={key}, code={code}")
            raise HTTPException(400, '驗證碼錯誤或過期')
    
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    user = None
    
    # 如果提供了 update_existing_user_id，則更新現有用戶而不是創建新用戶
    if update_existing_user_id:
        print(f"[verify_otp] 更新現有用戶模式，用戶 ID: {update_existing_user_id}")
        
        # 先獲取現有用戶資料
        cursor.execute('SELECT * FROM users WHERE id=%s', (update_existing_user_id,))
        user = cursor.fetchone()
        
        if not user:
            cursor.close()
            conn.close()
            raise HTTPException(400, '找不到要更新的用戶')
        
        # 更新現有用戶的 email/phone 和驗證狀態
        if phone:
            print(f"[verify_otp] 更新用戶 {update_existing_user_id} 的電話: {phone}")
            cursor.execute('UPDATE users SET phone=%s, phone_verified=TRUE WHERE id=%s', (phone, update_existing_user_id))
        elif email:
            print(f"[verify_otp] 更新用戶 {update_existing_user_id} 的 Email: {email}")
            cursor.execute('UPDATE users SET email=%s, email_verified=TRUE WHERE id=%s', (email, update_existing_user_id))
        
        conn.commit()
        
        # 重新查詢更新後的用戶資料
        cursor.execute('SELECT * FROM users WHERE id=%s', (update_existing_user_id,))
        user = cursor.fetchone()
        
    else:
        # 原有的邏輯：查有無此用戶，沒有就自動註冊
        print("[verify_otp] 自動註冊模式")
        if phone:
            cursor.execute('SELECT * FROM users WHERE phone=%s', (phone,))
            user = cursor.fetchone()
            if not user:
                cursor.execute('INSERT INTO users (phone, phone_verified) VALUES (%s, TRUE)', (phone,))
                conn.commit()
                cursor.execute('SELECT * FROM users WHERE phone=%s', (phone,))
                user = cursor.fetchone()
            else:
                cursor.execute('UPDATE users SET phone_verified=TRUE WHERE phone=%s', (phone,))
                conn.commit()
        elif email:
            cursor.execute('SELECT * FROM users WHERE email=%s', (email,))
            user = cursor.fetchone()
            if not user:
                cursor.execute('INSERT INTO users (email, email_verified) VALUES (%s, TRUE)', (email,))
                conn.commit()
                cursor.execute('SELECT * FROM users WHERE email=%s', (email,))
                user = cursor.fetchone()
            else:
                cursor.execute('UPDATE users SET email_verified=TRUE WHERE email=%s', (email,))
                conn.commit()
    
    cursor.close()
    conn.close()
    print('[verify_otp] 回傳 user:', user)
    
    # 產生 token
    token = create_access_token({'user_id': user['id'], 'role': user['role']})
    refresh_token = create_refresh_token({'user_id': user['id'], 'role': user['role']})
    return {'success': True, 'token': token, 'refresh_token': refresh_token, 'user': user}

@router.post('/api/auth/refresh')
def refresh_token_api(payload: dict):
    refresh_token = payload.get('refresh_token')
    data = decode_token(refresh_token, 'refresh')
    if not data:
        raise HTTPException(401, 'refresh_token 無效或過期')
    new_token = create_access_token({'user_id': data['user_id'], 'role': data['role']})
    return {'access_token': new_token}

 

@router.post('/api/auth/google-login',
    summary="Google 登入/註冊",
    description="使用 Google OAuth 進行登入或註冊，支援智能帳號綁定",
    response_description="返回 JWT tokens 和用戶資訊"
)
def google_login(payload: dict):
    """
    Google OAuth 登入處理 - 重構版
    
    流程：
    1. 若 google_id 已綁到某帳號 → 直接登入該帳號
    2. 若 google_id 未綁，但找到同 email 的既有帳號 → 綁定並登入
    3. 若找不到 email/帳號 → 建立新帳號並登入
    4. 若 email 對應的帳號已綁別人的 google_id → 回傳 409 衝突
    
    Args:
        payload: 包含 id_token 或直接用戶資訊的字典
        
    Returns:
        成功時返回 JWT tokens 和用戶資訊
    """
    print(f"[Google Login] 收到請求，payload: {payload}")
    
    # 解析 Google 用戶資訊
    email, google_id, name, picture = _extract_google_user_info(payload)
    
    if not email or not google_id:
        print(f"[Google Login] 缺少必要資訊，email: {email}, google_id: {google_id}")
        raise HTTPException(400, '缺少 email 或 google_id')
    
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # 使用事務確保資料一致性，避免競態條件
        cursor.execute('START TRANSACTION')
        
        # 步驟 1: 檢查 google_id 是否已綁定（加鎖避免競態）
        print(f"[Google Login] 步驟1: 檢查 google_id 綁定狀態: {google_id}")
        cursor.execute('SELECT * FROM users WHERE google_id = %s FOR UPDATE', (google_id,))
        existing_google_user = cursor.fetchone()
        
        if existing_google_user:
            # 情況 1: google_id 已綁定 → 直接登入
            print(f"[Google Login] 情況1: google_id 已綁定到用戶 ID: {existing_google_user['id']}")
            cursor.execute('COMMIT')
            return _generate_login_response(existing_google_user)
        
        # 步驟 2: 檢查 email 是否存在既有帳號（加鎖避免競態）
        print(f"[Google Login] 步驟2: 檢查 email 既有帳號: {email}")
        cursor.execute('SELECT * FROM users WHERE email = %s FOR UPDATE', (email,))
        existing_email_user = cursor.fetchone()
        
        if existing_email_user:
            # 檢查是否已綁定其他 google_id
            if existing_email_user.get('google_id') and existing_email_user['google_id'] != google_id:
                # 情況 4: email 對應的帳號已綁定其他 google_id → 409 衝突
                print(f"[Google Login] 情況4: email {email} 已綁定其他 Google 帳號: {existing_email_user['google_id']}")
                cursor.execute('ROLLBACK')
                raise HTTPException(409, {
                    'error': 'email_already_bound',
                    'message': '此 email 已綁定其他 Google 帳號，請先用原方式登入再手動綁定',
                    'existing_user_id': existing_email_user['id']
                })
            
            # 情況 2: 找到同 email 的既有帳號且未綁定 → 綁定並登入
            print(f"[Google Login] 情況2: 綁定既有帳號，用戶 ID: {existing_email_user['id']}")
            cursor.execute('''
                UPDATE users 
                SET google_id = %s, email_verified = TRUE
                WHERE id = %s
            ''', (google_id, existing_email_user['id']))
            
            # 重新查詢更新後的用戶資料
            cursor.execute('SELECT * FROM users WHERE id = %s', (existing_email_user['id'],))
            updated_user = cursor.fetchone()
            
            cursor.execute('COMMIT')
            print(f"[Google Login] 綁定成功，用戶 ID: {updated_user['id']}")
            return _generate_login_response(updated_user)
        
        # 情況 3: 找不到 email/帳號 → 建立新帳號並登入
        print(f"[Google Login] 情況3: 建立新用戶，email: {email}, google_id: {google_id}")
        
        cursor.execute('''
            INSERT INTO users (
                email, google_id, full_name,
                email_verified, role
            ) VALUES (%s, %s, %s, TRUE, 'patient')
        ''', (email, google_id, name))
        
        new_user_id = cursor.lastrowid
        cursor.execute('SELECT * FROM users WHERE id = %s', (new_user_id,))
        new_user = cursor.fetchone()
        
        cursor.execute('COMMIT')
        print(f"[Google Login] 新用戶建立成功，ID: {new_user['id']}")
        return _generate_login_response(new_user)
        
    except HTTPException:
        cursor.execute('ROLLBACK')
        raise
    except Exception as e:
        cursor.execute('ROLLBACK')
        print(f"[Google Login] 未預期的錯誤: {str(e)}")
        raise HTTPException(500, f'Google 登入處理失敗: {str(e)}')
    finally:
        cursor.close()
        conn.close()


def _extract_google_user_info(payload: dict) -> tuple:
    """
    從 payload 中提取 Google 用戶資訊
    支援 ID Token 模式和直接用戶資訊模式
    
    Returns:
        tuple: (email, google_id, name, picture)
    """
    id_token = payload.get('id_token')
    
    if id_token:
        # ID Token 模式：驗證 token
        print(f"[Google Login] ID Token 模式，開始驗證...")
        try:
            google_resp = requests.get(f'https://oauth2.googleapis.com/tokeninfo?id_token={id_token}')
            
            if google_resp.status_code != 200:
                print(f"[Google Login] Google token 驗證失敗，狀態碼: {google_resp.status_code}")
                raise HTTPException(400, 'Google token 驗證失敗')
            
            google_data = google_resp.json()
            print(f"[Google Login] Google 驗證成功")
            
            return (
                google_data.get('email'),
                google_data.get('sub'),
                google_data.get('name', ''),
                google_data.get('picture', '')
            )
            
        except Exception as e:
            print(f"[Google Login] ID Token 驗證錯誤: {e}")
            raise HTTPException(400, 'Google token 驗證失敗')
    else:
        # 直接用戶資訊模式
        print(f"[Google Login] 直接用戶資訊模式")
        check_only = payload.get('check_only', False)
        
        # 如果是僅檢查模式且只有 email，返回用戶不存在
        if check_only and not payload.get('google_id'):
            print(f"[Google Login] 僅檢查模式，email: {payload.get('email')}")
            raise HTTPException(400, '僅檢查模式，無完整用戶資訊')
        
        return (
            payload.get('email'),
            payload.get('google_id'),
            payload.get('name', ''),
            payload.get('picture', '')
        )


def _generate_login_response(user: dict) -> dict:
    """
    生成登入回應
    
    Args:
        user: 用戶資料字典
        
    Returns:
        dict: 包含 tokens 和用戶資訊的回應
    """
    # 產生 JWT tokens
    token = create_access_token({'user_id': user['id'], 'role': user['role']})
    refresh_token = create_refresh_token({'user_id': user['id'], 'role': user['role']})
    
    print(f"[Google Login] 登入成功，用戶 ID: {user['id']}, 角色: {user['role']}")
    
    return {
        'success': True,
        'token': token,
        'refresh_token': refresh_token,
        'user': user
    }

@router.post('/api/auth/logout')
def logout(user=Depends(get_current_user())):
    # conn = get_db()
    # cursor = conn.cursor()
    # cursor.execute('UPDATE users SET session_id=NULL WHERE id=%s', (user['user_id'],))
    # conn.commit()
    # cursor.close()
    # conn.close()
    return {'success': True, 'message': '已登出'}


@router.post('/api/auth/bind-google',
    summary="綁定 Google 帳號",
    description="將 Google 帳號綁定到當前登入的用戶",
    response_description="返回綁定結果"
)
def bind_google_account(payload: dict, user=Depends(get_current_user())):
    """
    手動綁定 Google 帳號到現有用戶
    用於已登入用戶主動綁定 Google 登入方式
    """
    email = payload.get('email')
    google_id = payload.get('google_id')
    name = payload.get('name', '')
    picture = payload.get('picture', '')
    
    if not email or not google_id:
        raise HTTPException(400, '缺少 email 或 google_id')
    
    user_id = user['user_id']
    print(f"[Bind Google] 綁定請求，用戶 ID: {user_id}, email: {email}, google_id: {google_id}")
    
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute('START TRANSACTION')
        
        # 檢查 Google 帳號是否已被其他用戶使用（加鎖避免競爭）
        cursor.execute('SELECT id FROM users WHERE google_id = %s FOR UPDATE', (google_id,))
        existing_google_user = cursor.fetchone()
        
        if existing_google_user and existing_google_user['id'] != user_id:
            print(f"[Bind Google] 錯誤：Google 帳號已被其他用戶使用，用戶 ID: {existing_google_user['id']}")
            cursor.execute('ROLLBACK')
            raise HTTPException(409, '此 Google 帳號已被其他用戶使用')
        
        # 檢查 email 是否已被其他用戶使用（加鎖避免競爭）
        cursor.execute('SELECT id FROM users WHERE email = %s AND id != %s FOR UPDATE', (email, user_id))
        existing_email_user = cursor.fetchone()
        
        if existing_email_user:
            print(f"[Bind Google] 錯誤：Email 已被其他用戶使用，用戶 ID: {existing_email_user['id']}")
            cursor.execute('ROLLBACK')
            raise HTTPException(409, '此 Email 已被其他用戶使用')
        
        # 檢查當前用戶是否已綁定其他 Google 帳號
        cursor.execute('SELECT google_id FROM users WHERE id = %s FOR UPDATE', (user_id,))
        current_user_data = cursor.fetchone()
        
        if current_user_data and current_user_data.get('google_id') and current_user_data['google_id'] != google_id:
            print(f"[Bind Google] 錯誤：用戶已綁定其他 Google 帳號: {current_user_data['google_id']}")
            cursor.execute('ROLLBACK')
            raise HTTPException(409, '您已綁定其他 Google 帳號，請先解除綁定')
        
        # 更新用戶資料，綁定 Google 帳號
        cursor.execute('''
            UPDATE users 
            SET google_id = %s, email = %s, full_name = COALESCE(NULLIF(full_name, ''), %s),
                email_verified = TRUE
            WHERE id = %s
        ''', (google_id, email, name, user_id))
        
        # 獲取更新後的用戶資料
        cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))
        updated_user = cursor.fetchone()
        
        cursor.execute('COMMIT')
        print(f"[Bind Google] 綁定成功，用戶 ID: {user_id}")
        
        return {
            'success': True,
            'message': 'Google 帳號綁定成功',
            'user': updated_user
        }
        
    except HTTPException:
        cursor.execute('ROLLBACK')
        raise
    except Exception as e:
        cursor.execute('ROLLBACK')
        print(f"[Bind Google] 錯誤: {e}")
        raise HTTPException(500, '綁定失敗')
    finally:
        cursor.close()
        conn.close()


@router.post('/api/auth/unbind-google',
    summary="解除 Google 帳號綁定",
    description="解除當前用戶的 Google 帳號綁定",
    response_description="返回解除綁定結果"
)
def unbind_google_account(user=Depends(get_current_user())):
    """
    解除 Google 帳號綁定
    用於已登入用戶主動解除 Google 登入方式
    """
    user_id = user['user_id']
    print(f"[Unbind Google] 解除綁定請求，用戶 ID: {user_id}")
    
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute('START TRANSACTION')
        
        # 檢查用戶是否已綁定 Google 帳號
        cursor.execute('SELECT google_id FROM users WHERE id = %s FOR UPDATE', (user_id,))
        current_user_data = cursor.fetchone()
        
        if not current_user_data or not current_user_data.get('google_id'):
            cursor.execute('ROLLBACK')
            raise HTTPException(400, '您尚未綁定 Google 帳號')
        
        # 解除 Google 帳號綁定
        cursor.execute('''
            UPDATE users 
            SET google_id = NULL
            WHERE id = %s
        ''', (user_id,))
        
        # 獲取更新後的用戶資料
        cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))
        updated_user = cursor.fetchone()
        
        cursor.execute('COMMIT')
        print(f"[Unbind Google] 解除綁定成功，用戶 ID: {user_id}")
        
        return {
            'success': True,
            'message': 'Google 帳號解除綁定成功',
            'user': updated_user
        }
        
    except HTTPException:
        cursor.execute('ROLLBACK')
        raise
    except Exception as e:
        cursor.execute('ROLLBACK')
        print(f"[Unbind Google] 錯誤: {e}")
        raise HTTPException(500, '解除綁定失敗')
    finally:
        cursor.close()
        conn.close()


@router.get('/api/auth/google-binding-status',
    summary="查詢 Google 綁定狀態",
    description="查詢當前用戶的 Google 帳號綁定狀態",
    response_description="返回綁定狀態資訊"
)
def get_google_binding_status(user=Depends(get_current_user())):
    """
    查詢 Google 綁定狀態
    用於前端顯示用戶的 Google 綁定狀態
    """
    user_id = user['user_id']
    
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute('SELECT google_id, email FROM users WHERE id = %s', (user_id,))
        user_data = cursor.fetchone()
        
        if not user_data:
            raise HTTPException(404, '用戶不存在')
        
        is_bound = bool(user_data.get('google_id'))
        
        return {
            'success': True,
            'is_bound': is_bound,
            'google_id': user_data.get('google_id') if is_bound else None,
            'email': user_data.get('email')
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Google Binding Status] 錯誤: {e}")
        raise HTTPException(500, '查詢狀態失敗')
    finally:
        cursor.close()
        conn.close()

@router.post('/api/auth/set-password')
def set_password(request: Request, payload: SetPasswordPayload):
    phone = payload.phone
    password = payload.password
    if not phone or not password:
        raise HTTPException(400, '缺少手機或密碼')
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT * FROM users WHERE phone=%s', (phone,))
    user = cursor.fetchone()
    if not user:
        raise HTTPException(404, '用戶不存在')
    hashed = hash_password(password)
    cursor.execute('UPDATE users SET password_hash=%s WHERE phone=%s', (hashed, phone))
    conn.commit()
    cursor.close()
    conn.close()
    return {'success': True, 'message': '密碼設置成功'}

@router.post('/api/auth/login', 
    summary="用戶登入",
    description="支援 Email 或電話號碼 + 密碼登入",
    response_description="返回 JWT token 和用戶資訊"
)
def login(request: Request, payload: LoginPayload):
    """
    用戶登入 API
    
    **流程**：
    1. 使用 Email 或電話號碼 + 密碼進行登入
    2. 驗證成功後返回 JWT tokens 和用戶資訊
    
    **參數**：
    - account: Email 或電話號碼
    - password: 用戶密碼
    
    **返回**：
    - success: 登入是否成功
    - token: JWT 存取令牌
    - refresh_token: JWT 刷新令牌  
    - user: 用戶完整資訊
    """
    account = payload.account
    password = payload.password
    
    if not account or not password:
        raise HTTPException(400, '缺少帳號或密碼')
    
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # 支援 phone 或 email 登入
        cursor.execute('SELECT * FROM users WHERE phone=%s OR email=%s', (account, account))
        user = cursor.fetchone()
        
        if not user or not user.get('password_hash'):
            raise HTTPException(401, '帳號或密碼錯誤')
            
        if not verify_password(password, user['password_hash']):
            raise HTTPException(401, '帳號或密碼錯誤')
        
        # 產生 JWT tokens
        token = create_access_token({'user_id': user['id'], 'role': user['role']})
        refresh_token = create_refresh_token({'user_id': user['id'], 'role': user['role']})
        
        print(f"[Login] 用戶登入成功: {user['id']}, account: {account}")
        return {'success': True, 'token': token, 'refresh_token': refresh_token, 'user': user}
        
    finally:
        cursor.close()
        conn.close()

@router.post('/api/auth/request-reset',
    summary="請求重設密碼",
    description="透過 Email 或電話號碼發送重設密碼驗證碼",
    response_description="確認驗證碼已發送"
)
def request_reset(request: Request, payload: ResetPasswordRequest):
    """
    請求重設密碼 API
    
    **流程**：
    1. 輸入 Email 或電話號碼
    2. 系統發送驗證碼到對應的聯絡方式
    3. 用戶收到驗證碼後，使用 reset-password API 重設密碼
    
    **參數**：
    - account: Email 或電話號碼
    
    **返回**：
    - success: 是否成功發送
    - message: 發送狀態訊息
    """
    account = payload.account
    if not account:
        raise HTTPException(400, '缺少帳號')
        
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute('SELECT * FROM users WHERE phone=%s OR email=%s', (account, account))
        user = cursor.fetchone()
        
        if not user:
            raise HTTPException(404, '用戶不存在')
        
        # 發送驗證碼
        if user.get('phone') == account:
            send_sms(account)
            print(f"[Reset Password] SMS 驗證碼已發送到: {account}")
        elif user.get('email') == account:
            code = gen_code()
            set_verify_code(f"email:{account}", code)
            send_email(account, '重設密碼驗證碼', f'您的驗證碼：{code}')
            print(f"[Reset Password] Email 驗證碼已發送到: {account}")
        
        return {'success': True, 'message': '驗證碼已發送'}
        
    finally:
        cursor.close()
        conn.close()

@router.post('/api/auth/reset-password',
    summary="重設密碼",
    description="使用驗證碼重設用戶密碼",
    response_description="確認密碼重設成功"
)
def reset_password(request: Request, payload: ResetPasswordPayload):
    print(f"[reset_password] payload: account={payload.account}, code={payload.code}, new_password={payload.new_password}")
    account = payload.account
    code = payload.code
    new_password = payload.new_password
    if not account or not code or not new_password:
        print("[reset_password] 缺少必要欄位")
        raise HTTPException(400, '缺少必要欄位')
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT * FROM users WHERE phone=%s OR email=%s', (account, account))
    user = cursor.fetchone()
    print(f"[reset_password] 查詢 user: {user}")
    if not user:
        print("[reset_password] 用戶不存在")
        raise HTTPException(404, '用戶不存在')
    # 只在這裡驗證一次驗證碼
    if user.get('phone') == account:
        print(f"[reset_password] phone驗證: account={account}, code={code}")
        result = verify_sms(account, code)
        print(f"[reset_password] verify_sms result: {result}")
        if not result:
            print("[reset_password] 驗證碼錯誤或過期 (phone)")
            raise HTTPException(400, '驗證碼錯誤或過期')
    elif user.get('email') == account:
        key = f"email:{account}"
        print(f"[reset_password] email驗證: key={key}, code={code}")
        result = check_verify_code(key, code)
        print(f"[reset_password] check_verify_code result: {result}")
        if not result:
            print("[reset_password] 驗證碼錯誤或過期 (email)")
            raise HTTPException(400, '驗證碼錯誤或過期')
    hashed = hash_password(new_password)
    print(f"[reset_password] hashed new_password: {hashed}")
    cursor.execute('UPDATE users SET password_hash=%s WHERE id=%s', (hashed, user['id']))
    conn.commit()
    cursor.close()
    conn.close()
    print("[reset_password] 密碼重設成功")
    return {'success': True, 'message': '密碼重設成功'}

@router.post('/api/auth/check-login-status')
def check_login_status(payload: dict):
    """
    檢查用戶的登入狀態
    用於輪詢機制檢查 Google OAuth 登入是否完成
    """
    email = payload.get('email')
    if not email:
        raise HTTPException(400, '缺少 email')
    
    print(f"[Check Login Status] 檢查用戶登入狀態，email: {email}")
    
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # 查找用戶
        cursor.execute('SELECT * FROM users WHERE email=%s', (email,))
        user = cursor.fetchone()
        
        if not user:
            print(f"[Check Login Status] 用戶不存在: {email}")
            return {'success': False, 'message': '用戶不存在'}
        
        # 如果用戶存在，生成新的 token（假設登入成功）
        print(f"[Check Login Status] 用戶存在，生成 token，用戶 ID: {user['id']}")
        
        token = create_access_token({'user_id': user['id'], 'role': user['role']})
        refresh_token = create_refresh_token({'user_id': user['id'], 'role': user['role']})
        
        return {
            'success': True,
            'token': token,
            'refresh_token': refresh_token,
            'user': user
        }
        
    except Exception as e:
        print(f"[Check Login Status] 錯誤: {e}")
        raise HTTPException(500, '檢查登入狀態失敗')
    finally:
        cursor.close()
        conn.close()

# =================================
# Google OAuth 回調處理器
# =================================

@router.get("/api/oauth/redirect")
async def google_oauth_redirect():
    """
    Google OAuth 重導向頁面
    用於 ID Token 模式的重導向處理
    這個端點會顯示一個頁面，將 OAuth 結果傳回到原來的視窗
    """
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>登入處理中</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { 
                font-family: Arial, sans-serif; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                height: 100vh; 
                margin: 0; 
                background: #f5f5f5;
            }
            .container { 
                text-align: center; 
                background: white; 
                padding: 2rem; 
                border-radius: 8px; 
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .spinner {
                border: 3px solid #f3f3f3;
                border-top: 3px solid #007bff;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                animation: spin 1s linear infinite;
                margin: 20px auto;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>🔐 處理登入資訊</h2>
            <div class="spinner"></div>
            <p>正在處理您的登入資訊...</p>
            <p><small>請勿關閉此頁面</small></p>
        </div>
        <script>
            // ✅ 立即顯示初始狀態，避免空頁面
            console.log('=== 重導向頁面載入開始 ===');
            console.log('當前時間:', new Date().toISOString());
            console.log('當前 URL:', window.location.href);
            
            // 立即更新頁面內容，表示正在處理
            function updateStatus(title, message, showSpinner = true) {
                const container = document.querySelector('.container');
                if (container) {
                    container.innerHTML = `
                        <h2>${title}</h2>
                        ${showSpinner ? '<div class="spinner"></div>' : ''}
                        <p>${message}</p>
                        <p><small>時間: ${new Date().toLocaleTimeString()}</small></p>
                    `;
                }
            }
            
            // 立即執行，不等待 DOMContentLoaded
            updateStatus('🔍 分析登入資訊', '正在檢查 Google 回調參數...');
            
            // 檢查 URL 中的查詢參數（授權碼模式）和 fragment（ID Token 模式）
            function handleOAuthCallback() {
                        // 檢查查詢參數（授權碼模式）
                        const queryParams = new URLSearchParams(window.location.search);
                        const authCode = queryParams.get('code');
                        const state = queryParams.get('state');
                        const queryError = queryParams.get('error');
                        
                        // 從 state 參數中解碼 code_verifier
                        let codeVerifier = null;
                        try {
                            if (state) {
                                const stateData = JSON.parse(atob(state));
                                codeVerifier = stateData.code_verifier;
                                console.log('Code verifier from state:', codeVerifier ? 'Found' : 'Not found');
                            }
                        } catch (e) {
                            console.log('無法從 state 解碼 code_verifier:', e);
                        }
                
                // 檢查 fragment（ID Token 模式）
                const fragment = window.location.hash.substring(1);
                const fragmentParams = new URLSearchParams(fragment);
                const idToken = fragmentParams.get('id_token');
                const accessToken = fragmentParams.get('access_token');
                const fragmentError = fragmentParams.get('error');
                
                // 合併錯誤檢查
                const error = queryError || fragmentError;
                
                console.log('=== OAuth Callback 詳細調試資訊 ===');
                console.log('完整 URL:', window.location.href);
                console.log('Query String:', window.location.search);
                console.log('Fragment:', window.location.hash);
                console.log('OAuth Callback Data:', { 
                    authCode: authCode ? authCode.substring(0, 20) + '...' : null, 
                    state: state ? state.substring(0, 20) + '...' : null, 
                    idToken: idToken ? idToken.substring(0, 20) + '...' : null, 
                    accessToken: accessToken ? accessToken.substring(0, 20) + '...' : null, 
                    error,
                    queryParams: Object.fromEntries(queryParams),
                    fragmentParams: Object.fromEntries(fragmentParams)
                });
                console.log('Window opener 存在:', !!window.opener);
                console.log('=== 調試資訊結束 ===');
                
                if (error) {
                    console.error('OAuth Error:', error);
                    
                    // 處理用戶取消的情況
                    if (error === 'access_denied') {
                        document.querySelector('.container').innerHTML = `
                            <h2>🚫 登入已取消</h2>
                            <p>您已取消 Google 登入</p>
                        `;
                        
                        // 通知父視窗用戶取消了登入
                        if (window.opener) {
                            window.opener.postMessage({
                                type: 'GOOGLE_OAUTH_CANCELLED'
                            }, '*');
                        }
                    } else {
                        document.querySelector('.container').innerHTML = `
                            <h2>❌ 登入失敗</h2>
                            <p>錯誤：${error}</p>
                        `;
                        
                        // 通知父視窗發生錯誤
                        if (window.opener) {
                            window.opener.postMessage({
                                type: 'GOOGLE_OAUTH_ERROR',
                                error: error
                            }, '*');
                        }
                    }
                    return;
                }
                
                // 處理授權碼模式
                if (authCode) {
                    console.log('Found authorization code, processing...');
                    console.log('Code verifier available:', codeVerifier ? 'Yes' : 'No');
                    
                    // ✅ 更新狀態顯示
                    updateStatus('🔐 找到授權碼', '正在向後端發送授權碼...');
                    
                    // 將授權碼、code_verifier 和 state 發送到後端處理
                    sendCodeToBackend(authCode, codeVerifier, state);
                    
                } else if (idToken) {
                    console.log('Found ID Token, processing...');
                    
                    // 將 token 傳送到父視窗（如果是彈出視窗）
                    if (window.opener) {
                        console.log('Sending token to parent window...');
                        window.opener.postMessage({
                            type: 'GOOGLE_OAUTH_SUCCESS',
                            id_token: idToken
                        }, '*');
                        window.close();
                        return;
                    }
                    
                    // 如果不是彈出視窗，嘗試重導向到應用程式
                    console.log('Not a popup, trying deep link...');
                    const deepLink = `avfcare://auth?id_token=${idToken}`;
                    window.location.href = deepLink;
                    
                    // 備案：顯示成功訊息
                    setTimeout(() => {
                        document.querySelector('.container').innerHTML = `
                            <h2>✅ 登入成功</h2>
                            <p>請返回應用程式繼續使用</p>
                            <p><small>如果應用程式沒有自動開啟，請手動開啟</small></p>
                        `;
                    }, 2000);
                } else {
                    console.log('No authorization code or ID token found');
                    updateStatus('⚠️ 未收到登入資訊', '請重新嘗試登入', false);
                    
                    // 顯示調試資訊
                    setTimeout(() => {
                        const container = document.querySelector('.container');
                        if (container) {
                            container.innerHTML += `<p><small>調試資訊：authCode=${authCode}, idToken=${idToken}</small></p>`;
                        }
                    }, 1000);
                }
            }
            
            // 將授權碼發送到後端處理
            async function sendCodeToBackend(authCode, codeVerifier, state) {
                try {
                    console.log('=== 發送授權碼到後端 - 詳細調試 ===');
                    console.log('Authorization Code:', authCode ? authCode.substring(0, 20) + '...' : 'null');
                    console.log('Code Verifier 存在:', !!codeVerifier);
                    console.log('Code Verifier 長度:', codeVerifier ? codeVerifier.length : 0);
                    console.log('State parameter:', state ? state.substring(0, 20) + '...' : 'null');
                    console.log('State 長度:', state ? state.length : 0);
                    console.log('當前時間:', new Date().toISOString());
                    console.log('=== 調試資訊結束 ===');
                    
                    // ✅ 更新狀態顯示 - 使用統一的 updateStatus 函數
                    updateStatus('🔐 後端驗證中', 
                        `正在向後端發送授權碼...<br>
                        <small>授權碼: ${authCode ? authCode.substring(0, 10) + '...' : '無'}</small><br>
                        <small>Code Verifier: ${codeVerifier ? '存在 (' + codeVerifier.length + ' 字元)' : '不存在'}</small>`
                    );
                    
                    const payload = { code: authCode };
                    if (codeVerifier) {
                        payload.code_verifier = codeVerifier;
                        console.log('Including code_verifier in payload (length:', codeVerifier.length, ')');
                    }
                    if (state) {
                        payload.state = state;
                        console.log('Including state in payload (length:', state.length, ')');
                    }
                    
                    console.log('準備發送的 payload:', {
                        code: payload.code ? payload.code.substring(0, 20) + '...' : null,
                        code_verifier: payload.code_verifier ? '存在 (' + payload.code_verifier.length + ' 字元)' : '不存在',
                        state: payload.state ? payload.state.substring(0, 20) + '...' : null
                    });
                    
                    const response = await fetch('/api/auth/google-callback', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(payload)
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        console.log('Backend response:', data);
                        
                        if (data.success) {
                            // ✅ 立即更新狀態顯示
                            updateStatus('✅ 後端驗證成功', '正在傳送登入資訊到應用程式...');
                            
                            // 將登入資訊傳送到父視窗
                            if (window.opener) {
                                console.log('Sending login data to parent window...');
                                console.log('Login data to send:', data);
                                
                                const messageData = {
                                    type: 'GOOGLE_OAUTH_SUCCESS',
                                    loginData: data
                                };
                                
                                console.log('Message to send:', messageData);
                                window.opener.postMessage(messageData, '*');
                                console.log('PostMessage sent successfully');
                                
                                // 備用方案：嘗試調用全域函數
                                try {
                                    if (window.opener && window.opener.handleGoogleLoginSuccess) {
                                        console.log('Calling global handler as backup...');
                                        window.opener.handleGoogleLoginSuccess(data);
                                    }
                                } catch (e) {
                                    console.log('Global handler not available:', e);
                                }
                                
                                // ✅ 顯示最終成功訊息
                                updateStatus('🎉 登入完成', 
                                    `歡迎，${data.user?.name || data.user?.email || '用戶'}！<br>
                                    登入完成，您可以關閉此頁面`, false);
                                return;
                            }
                            
                            // 如果不是彈出視窗，嘗試使用 URL 參數重導向
                            console.log('Not a popup, trying URL redirect with login data...');
                            const params = new URLSearchParams({
                                google_auth: 'success',
                                access_token: data.token,
                                refresh_token: data.refresh_token || '',
                                user_id: data.user.id,
                                user_role: data.user.role,
                                user_email: data.user.email || '',
                                user_phone: data.user.phone || '',
                                user_id_number: data.user.id_number || '',
                                user_birthdate: data.user.birthdate || ''
                            });
                            
                            const redirectUrl = `avfcare://auth?${params.toString()}`;
                            console.log('Redirecting to:', redirectUrl);
                            window.location.href = redirectUrl;
                            
                            // 備案：顯示成功訊息
                            setTimeout(() => {
                                document.querySelector('.container').innerHTML = `
                                    <h2>✅ 登入成功</h2>
                                    <p>歡迎，${data.user?.name || data.user?.email || '用戶'}！</p>
                                    <p>登入完成，您可以關閉此頁面</p>
                                `;
                            }, 2000);
                        } else {
                            throw new Error(data.message || '後端處理失敗');
                        }
                    } else {
                        const errorText = await response.text();
                        throw new Error(`HTTP ${response.status}: ${errorText}`);
                    }
                    
                } catch (error) {
                    console.error('Error sending code to backend:', error);
                    // ✅ 使用統一的錯誤狀態顯示
                    updateStatus('❌ 授權碼處理失敗', 
                        `錯誤：${error.message}<br>請重新嘗試登入`, false);
                }
            }
            
            // ✅ 立即執行和 DOMContentLoaded 雙重保障
            // 如果 DOM 已經準備好，立即執行
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', handleOAuthCallback);
            } else {
                // DOM 已經載入完成，立即執行
                handleOAuthCallback();
            }
            
            // 額外的超時保障，防止 JavaScript 執行問題
            setTimeout(() => {
                if (document.querySelector('.container h2').textContent.includes('處理登入資訊')) {
                    console.log('⚠️ JavaScript 執行可能有問題，嘗試手動處理...');
                    handleOAuthCallback();
                }
            }, 2000);
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@router.post("/api/auth/google-callback")
async def google_callback_post(payload: dict):
    """
    Google OAuth 授權碼處理 (POST)
    接收來自重導向頁面的授權碼，換取 access token 並處理登入
    """
    try:
        code = payload.get('code')
        code_verifier = payload.get('code_verifier')
        state = payload.get('state')
        
        if not code:
            raise HTTPException(status_code=400, detail="缺少授權碼")
        
        print(f"[Google Callback POST] 收到授權碼處理請求")
        print(f"[Google Callback POST] 完整 payload: {payload}")
        print(f"[Google Callback POST] Code verifier 提供: {'是' if code_verifier else '否'}")
        print(f"[Google Callback POST] State 參數: {state}")
        print(f"[Google Callback POST] State 參數類型: {type(state)}, 長度: {len(state) if state else 0}")
        
        # 解析 state 參數以獲取 linking_user_id 和 code_verifier
        linking_user_id = None
        if state:
            print(f"[Google Callback POST] 嘗試從 state 中解析參數...")
            try:
                # ✅ 修復：先嘗試 base64 + JSON 格式（與前端重導向頁面一致）
                try:
                    import base64
                    import json
                    state_data = json.loads(base64.b64decode(state).decode())
                    if not code_verifier:  # 只有在沒有直接提供 code_verifier 時才從 state 解析
                        code_verifier = state_data.get('code_verifier')
                    linking_user_id = state_data.get('linking_user_id')
                    print(f"[Google Callback POST] 從 base64+JSON state 解析成功: linking_user_id={linking_user_id}, code_verifier={'存在' if code_verifier else '不存在'}")
                    print(f"[Google Callback POST] Code verifier 長度: {len(code_verifier) if code_verifier else 0}")
                except:
                    # 備案：嘗試解析簡單的 state 格式：userId_codeVerifier
                    if '_' in state:
                        parts = state.split('_', 1)
                        print(f"[Google Callback POST] 分割 state 結果: parts={parts}")
                        if len(parts) == 2:
                            linking_user_id = parts[0]
                            if not code_verifier:  # 只有在沒有直接提供 code_verifier 時才從 state 解析
                                code_verifier = parts[1]
                            print(f"[Google Callback POST] 從簡單 state 解析成功: linking_user_id={linking_user_id}, code_verifier={'存在' if code_verifier else '不存在'}")
                            print(f"[Google Callback POST] Code verifier 長度: {len(code_verifier) if code_verifier else 0}")
                        else:
                            print(f"[Google Callback POST] state 格式不正確: {state}")
                    else:
                        print(f"[Google Callback POST] state 中沒有 '_' 分隔符，且不是有效的 base64")
            except Exception as e:
                print(f"[Google Callback POST] 無法從 state 解析參數: {e}")
        
        print(f"[Google Callback POST] 最終 Code verifier 提供: {'是' if code_verifier else '否'}")
        print(f"[Google Callback POST] 最終 Linking user ID: {linking_user_id}")
        
        # 使用授權碼換取 access token
        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": "https://avfcare.com/api/oauth/redirect"
        }
        
        # 如果有 code_verifier，加入 PKCE 參數
        if code_verifier:
            token_data["code_verifier"] = code_verifier
        
        print("[Google Callback POST] 正在換取存取令牌...")
        response = requests.post(token_url, data=token_data)
        token_info = response.json()
        
        if "access_token" not in token_info:
            print(f"[Google Callback POST] 換取令牌失敗: {token_info}")
            raise HTTPException(status_code=400, detail="無法取得存取令牌")
        
        # 使用 access token 獲取用戶資訊
        user_info_url = f"https://www.googleapis.com/oauth2/v2/userinfo?access_token={token_info['access_token']}"
        user_response = requests.get(user_info_url)
        user_data = user_response.json()
        
        print(f"[Google Callback POST] 用戶資訊: {user_data}")
        
        if not user_data.get('email'):
            print("[Google Callback POST] 無法獲取用戶 email")
            raise HTTPException(status_code=400, detail="無法獲取用戶資訊")
        
        # 處理用戶登入邏輯
        if linking_user_id:
            # 這是綁定操作：將 Google 帳號綁定到現有用戶
            print(f"[Google Callback POST] 執行 Google 帳號綁定操作，用戶 ID: {linking_user_id}")
            
            conn = get_db()
            cursor = conn.cursor(dictionary=True)
            
            try:
                cursor.execute('START TRANSACTION')
                
                # 檢查現有用戶是否存在
                cursor.execute('SELECT * FROM users WHERE id = %s FOR UPDATE', (linking_user_id,))
                existing_user = cursor.fetchone()
                
                if not existing_user:
                    cursor.execute('ROLLBACK')
                    raise HTTPException(status_code=400, detail="指定的用戶不存在")
                
                # 檢查 Google 帳號是否已經被其他用戶使用
                cursor.execute('SELECT * FROM users WHERE google_id = %s AND id != %s', (user_data.get('id', ''), linking_user_id))
                google_conflict = cursor.fetchone()
                
                if google_conflict:
                    cursor.execute('ROLLBACK')
                    raise HTTPException(status_code=400, detail="此 Google 帳號已被其他用戶使用")
                
                # 更新用戶資料，綁定 Google 帳號
                update_fields = []
                update_values = []
                
                update_fields.append("google_id = %s")
                update_values.append(user_data.get('id', ''))
                
                # 如果用戶沒有 email，使用 Google email
                if not existing_user.get('email'):
                    update_fields.append("email = %s")
                    update_values.append(user_data['email'])
                    update_fields.append("email_verified = %s")
                    update_values.append(True)
                
                # 如果用戶沒有姓名，使用 Google 姓名
                if not existing_user.get('full_name') and user_data.get('name'):
                    update_fields.append("full_name = %s")
                    update_values.append(user_data.get('name'))
                
                update_values.append(linking_user_id)
                
                cursor.execute(f'''
                    UPDATE users SET {', '.join(update_fields)}
                    WHERE id = %s
                ''', update_values)
                
                # 獲取更新後的用戶資料
                cursor.execute('SELECT * FROM users WHERE id = %s', (linking_user_id,))
                updated_user = cursor.fetchone()
                
                cursor.execute('COMMIT')
                print(f"[Google Callback POST] Google 帳號綁定成功，用戶 ID: {linking_user_id}")
                
                return {
                    'success': True,
                    'message': 'Google 帳號綁定成功',
                    'user': updated_user
                }
                
            except HTTPException:
                cursor.execute('ROLLBACK')
                raise
            except Exception as e:
                cursor.execute('ROLLBACK')
                print(f"[Google Callback POST] 綁定錯誤: {e}")
                raise HTTPException(status_code=500, detail="綁定失敗")
            finally:
                cursor.close()
                conn.close()
        else:
            # 這是正常的登入/註冊操作，複用現有的 google_login 邏輯
            user_payload = {
                'email': user_data.get('email'),
                'google_id': user_data.get('id'),
                'name': user_data.get('name'),
                'picture': user_data.get('picture'),
                'verified_email': user_data.get('verified_email')
            }
            
            # 調用現有的 google_login 邏輯
            return google_login(user_payload)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Google Callback POST] 處理失敗: {e}")
        raise HTTPException(status_code=500, detail="授權碼處理失敗")

@router.get("/api/auth/google-callback")
async def google_callback(code: str = Query(None), state: str = Query(None)):
    """
    Google OAuth 回調處理器
    處理從 Google 重新導向回來的授權碼
    
    流程:
    1. 使用授權碼換取存取令牌
    2. 使用存取令牌獲取用戶資訊
    3. 檢查用戶是否已存在，如不存在則建立新用戶
    4. 生成 JWT token 並重新導向到前端
    """
    try:
        # 檢查是否有授權碼
        if not code:
            print("[Google OAuth] 回調請求缺少授權碼")
            raise HTTPException(
                status_code=400, 
                detail="缺少授權碼。請注意：此端點用於傳統 OAuth 流程，如使用 ID Token 模式請直接調用 /api/auth/google-login"
            )
        
        print(f"[Google OAuth] 收到回調，code: {code[:10]}..., state: {state}")
        print(f"[Google OAuth] State 參數詳情: 長度={len(state) if state else 0}, 內容={state}")
        
        # 檢查 state 參數中是否包含 linking_user_id（表示這是綁定操作）
        linking_user_id = None
        code_verifier = None
        
        if state:
            print(f"[Google OAuth] 開始解析 state 參數: {state[:50]}...")
            try:
                # 嘗試解析簡單的 state 格式：userId_codeVerifier
                if '_' in state:
                    parts = state.split('_', 1)
                    print(f"[Google OAuth] 分割 state 結果: parts={parts}")
                    if len(parts) == 2:
                        linking_user_id = parts[0]
                        code_verifier = parts[1]
                        print(f"[Google OAuth] 解析 state 成功: linking_user_id={linking_user_id}, code_verifier={'存在' if code_verifier else '不存在'}")
                        print(f"[Google OAuth] Code verifier 長度: {len(code_verifier) if code_verifier else 0}")
                    else:
                        print(f"[Google OAuth] state 格式不正確: {state}")
                else:
                    print(f"[Google OAuth] state 中沒有 '_' 分隔符，嘗試 base64 格式")
                    # 嘗試舊的 base64 格式
                    import base64
                    import json
                    state_data = json.loads(base64.b64decode(state).decode())
                    linking_user_id = state_data.get('linking_user_id')
                    code_verifier = state_data.get('code_verifier')
                    print(f"[Google OAuth] 解析 base64 state: linking_user_id={linking_user_id}, code_verifier={'存在' if code_verifier else '不存在'}")
            except Exception as e:
                print(f"[Google OAuth] 無法解析 state 參數: {e}, state: {state}")
        else:
            print(f"[Google OAuth] state 參數為空或 None")
        
        # 步驟 1: 使用授權碼換取存取令牌
        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": GOOGLE_REDIRECT_URI
        }
        
        # 如果有 code_verifier，加入到請求中（PKCE 流程）
        if code_verifier:
            token_data["code_verifier"] = code_verifier
            print("[Google OAuth] 使用 PKCE 流程，加入 code_verifier")
        
        print("[Google OAuth] 正在換取存取令牌...")
        response = requests.post(token_url, data=token_data)
        token_info = response.json()
        
        if "access_token" not in token_info:
            print(f"[Google OAuth] 換取令牌失敗: {token_info}")
            raise HTTPException(status_code=400, detail="無法取得存取令牌")
        
        # 步驟 2: 使用存取令牌獲取用戶資訊
        user_info_url = f"https://www.googleapis.com/oauth2/v2/userinfo?access_token={token_info['access_token']}"
        user_response = requests.get(user_info_url)
        user_data = user_response.json()
        
        print(f"[Google OAuth] 用戶資訊: {user_data}")
        
        if not user_data.get('email'):
            print("[Google OAuth] 無法獲取用戶 email")
            raise HTTPException(status_code=400, detail="無法獲取用戶資訊")
        
        # 步驟 3: 處理用戶邏輯
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        if linking_user_id:
            # 這是綁定操作：將 Google 帳號綁定到現有用戶
            print(f"[Google OAuth] 執行 Google 帳號綁定操作，用戶 ID: {linking_user_id}")
            
            # 檢查現有用戶是否存在
            cursor.execute('SELECT * FROM users WHERE id = %s', (linking_user_id,))
            existing_user = cursor.fetchone()
            
            if not existing_user:
                cursor.close()
                conn.close()
                raise HTTPException(status_code=400, detail="指定的用戶不存在")
            
            # 檢查 Google 帳號是否已經被其他用戶使用
            cursor.execute('SELECT * FROM users WHERE google_id = %s AND id != %s', (user_data.get('id', ''), linking_user_id))
            google_conflict = cursor.fetchone()
            
            if google_conflict:
                cursor.close()
                conn.close()
                raise HTTPException(status_code=400, detail="此 Google 帳號已被其他用戶使用")
            
            # 更新用戶資料，綁定 Google 帳號
            update_fields = []
            update_values = []
            
            update_fields.append("google_id = %s")
            update_values.append(user_data.get('id', ''))
            
            # 如果用戶沒有 email，使用 Google email
            if not existing_user.get('email'):
                update_fields.append("email = %s")
                update_values.append(user_data['email'])
                update_fields.append("email_verified = %s")
                update_values.append(True)
            
            # 如果用戶沒有姓名，使用 Google 姓名
            if not existing_user.get('full_name') and user_data.get('name'):
                update_fields.append("full_name = %s")
                update_values.append(user_data.get('name'))
            
            update_values.append(linking_user_id)
            
            cursor.execute(f'''
                UPDATE users SET {', '.join(update_fields)}
                WHERE id = %s
            ''', update_values)
            
            conn.commit()
            cursor.close()
            conn.close()
            
            print(f"[Google OAuth] Google 帳號綁定成功，用戶 ID: {linking_user_id}")
            
            # 重新導向到個人資料頁面
            redirect_url = f"https://avfcare.com/user/profile?google_link=success"
            
        else:
            # 這是正常的登入/註冊操作
            cursor.execute('SELECT * FROM users WHERE email = %s', (user_data['email'],))
            existing_user = cursor.fetchone()
            
            if existing_user:
                # 用戶已存在，直接登入
                user_id = existing_user['id']
                user_role = existing_user['role']
                print(f"[Google OAuth] 現有用戶登入: {user_data['email']}, role: {user_role}")
            else:
                # 新用戶，建立帳號（預設為 patient 角色）
                cursor.execute('''
                    INSERT INTO users (email, full_name, role, is_active, google_id, email_verified)
                    VALUES (%s, %s, %s, %s, %s, %s)
                ''', (
                    user_data['email'],
                    user_data.get('name', ''),
                    'patient',  # 預設角色
                    True,
                    user_data.get('id', ''),
                    True  # Google 帳號的 email 預設為已驗證
                ))
                conn.commit()
                user_id = cursor.lastrowid
                user_role = 'patient'
                print(f"[Google OAuth] 新用戶建立: {user_data['email']}, user_id: {user_id}")
            
            cursor.close()
            conn.close()
            
            # 步驟 4: 生成 JWT token
            access_token = create_access_token({'id': user_id, 'role': user_role})
            refresh_token = create_refresh_token({'id': user_id, 'role': user_role})
            
            # 重新導向到前端，傳遞必要資訊
            redirect_url = f"https://avfcare.com?google_auth=success&access_token={access_token}&refresh_token={refresh_token}&user_id={user_id}&role={user_role}&email={user_data['email']}"
        
        print(f"[Google OAuth] 成功完成，重新導向到: {redirect_url[:100]}...")
        return RedirectResponse(url=redirect_url)
        
    except Exception as e:
        print(f"[Google OAuth] 處理失敗: {e}")
        # 重新導向到前端並顯示錯誤
        error_url = f"https://avfcare.com?google_auth=error&message={str(e)}"
        return RedirectResponse(url=error_url)
