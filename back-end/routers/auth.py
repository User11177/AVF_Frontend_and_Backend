# auth.py
# 身份驗證路由器 - 處理用戶登入、註冊、密碼管理等功能
# 包含 OTP 驗證、JWT token 管理、密碼重設等安全機制

# 導入必要的模組
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from db import get_db                    # 資料庫連線
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

@router.post('/api/auth/request-otp')
def request_otp(request: Request, payload: dict):
    """
    請求 OTP 驗證碼
    支援手機簡訊和 Email 兩種方式
    
    Args:
        payload: 包含 phone 或 email 的字典
        
    Returns:
        成功訊息
        
    Raises:
        HTTPException: 當同時提供或都不提供 phone 和 email 時
    """
    phone = payload.get('phone')
    email = payload.get('email')
    
    # 驗證輸入：只能選擇一種驗證方式
    if (phone and email) or (not phone and not email):
        raise HTTPException(400, '請只填寫手機或 Email 其中一個')
    
    if phone:
        # 透過 Twilio 發送手機驗證碼
        send_sms(phone)  # Twilio 會自動產生驗證碼
    
    if email:
        # 透過 Gmail SMTP 發送 Email 驗證碼
        code = gen_code()                              # 生成6位數驗證碼
        set_verify_code(f"email:{email}", code)        # 儲存驗證碼到快取
        send_email(email, '登入驗證碼', f'您的驗證碼：{code}')  # 發送郵件
    
    return {'success': True, 'message': '驗證碼已發送'}

@router.post('/api/auth/verify-otp')
def verify_otp(request: Request, payload: dict):
    phone = payload.get('phone')
    email = payload.get('email')
    code = payload.get('code')
    if (phone and email) or (not phone and not email):
        raise HTTPException(400, '請只填寫手機或 Email 其中一個')
    if phone:
        if not verify_sms(phone, code):
            print(f"[verify_otp] Twilio 驗證失敗 phone={phone}, code={code}")
            raise HTTPException(400, '驗證碼錯誤或過期')
    if email:
        key = f"email:{email}"
        if not check_verify_code(key, code):
            print(f"[verify_otp] 驗證失敗 key={key}, code={code}")
            raise HTTPException(400, '驗證碼錯誤或過期')
    # 查有無此用戶，沒有就自動註冊
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    user = None
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
    # 產生新 session_id
    # session_id = secrets.token_hex(16)
    # 更新 DB
    # conn = get_db()
    # cursor = conn.cursor()
    # cursor.execute('UPDATE users SET session_id=%s WHERE id=%s', (session_id, user['id']))
    # conn.commit()
    # cursor.close()
    # conn.close()
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

@router.get('/api/oauth/google/callback')
def google_oauth_callback():
    """
    Google OAuth 回調端點（已不使用）
    現在使用 avfcare://redirect 直接回到 App，不經過後端
    """
    return {
        'message': 'OAuth callback endpoint (deprecated)',
        'note': 'Now using avfcare://redirect for direct app callback',
        'status': 'not_used'
    }

@router.post('/api/auth/google-login')
def google_login(payload: dict):
    """
    Google OAuth 登入處理
    
    Args:
        payload: 包含 id_token 的字典
        
    Returns:
        成功時返回 JWT tokens 和用戶資訊
    """
    print(f"[Google Login] 收到請求，payload: {payload}")
    
    id_token = payload.get('id_token')
    if not id_token:
        print("[Google Login] 錯誤：缺少 id_token")
        raise HTTPException(400, '缺少 id_token')
    
    try:
        # 驗證 Google id_token
        print(f"[Google Login] 開始驗證 Google token...")
        google_resp = requests.get(f'https://oauth2.googleapis.com/tokeninfo?id_token={id_token}')
        
        if google_resp.status_code != 200:
            print(f"[Google Login] Google token 驗證失敗，狀態碼: {google_resp.status_code}")
            raise HTTPException(400, 'Google token 驗證失敗')
        
        google_data = google_resp.json()
        print(f"[Google Login] Google 驗證成功，資料: {google_data}")
        
        email = google_data.get('email')
        google_id = google_data.get('sub')
        
        if not email or not google_id:
            print(f"[Google Login] 錯誤：Google token 缺少必要資訊，email: {email}, google_id: {google_id}")
            raise HTTPException(400, 'Google token 缺少 email 或 sub')
        
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 1. 先用 google_id 查找
            print(f"[Google Login] 使用 google_id 查找用戶: {google_id}")
            cursor.execute('SELECT * FROM users WHERE google_id=%s', (google_id,))
            user = cursor.fetchone()
            
            # 2. 若無，再用 email 查找，並補上 google_id
            if not user:
                print(f"[Google Login] 未找到 google_id 用戶，使用 email 查找: {email}")
                cursor.execute('SELECT * FROM users WHERE email=%s', (email,))
                user = cursor.fetchone()
                
                if user:
                    # 若該帳號已綁定其他 google_id，不允許重複綁定
                    if user.get('google_id') and user['google_id'] != google_id:
                        print(f"[Google Login] 錯誤：email {email} 已綁定其他 Google 帳號")
                        raise HTTPException(400, '此 email 已綁定其他 Google 帳號')
                    
                    print(f"[Google Login] 更新現有用戶，綁定 google_id: {google_id}")
                    cursor.execute('UPDATE users SET google_id=%s, email_verified=TRUE WHERE id=%s', (google_id, user['id']))
                    conn.commit()
                    cursor.execute('SELECT * FROM users WHERE id=%s', (user['id'],))
                    user = cursor.fetchone()
            
            # 3. 若都沒有，新增用戶
            if not user:
                print(f"[Google Login] 建立新用戶，email: {email}, google_id: {google_id}")
                # 為新 Google 用戶設定預設角色為 'patient'
                cursor.execute('INSERT INTO users (email, google_id, email_verified, role) VALUES (%s, %s, TRUE, %s)', 
                             (email, google_id, 'patient'))
                conn.commit()
                cursor.execute('SELECT * FROM users WHERE google_id=%s', (google_id,))
                user = cursor.fetchone()
                print(f"[Google Login] 新用戶建立成功，ID: {user['id']}")
            
            if not user:
                print("[Google Login] 錯誤：無法建立或取得用戶資料")
                raise HTTPException(500, '無法建立或取得用戶資料')
            
            print(f"[Google Login] 用戶資料: {user}")
            
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
            
        finally:
            cursor.close()
            conn.close()
            
    except HTTPException:
        # 重新拋出 HTTP 異常
        raise
    except Exception as e:
        print(f"[Google Login] 未預期的錯誤: {str(e)}")
        raise HTTPException(500, f'Google 登入處理失敗: {str(e)}')

@router.post('/api/auth/logout')
def logout(user=Depends(get_current_user())):
    # conn = get_db()
    # cursor = conn.cursor()
    # cursor.execute('UPDATE users SET session_id=NULL WHERE id=%s', (user['user_id'],))
    # conn.commit()
    # cursor.close()
    # conn.close()
    return {'success': True, 'message': '已登出'}

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

@router.post('/api/auth/login')
def login(request: Request, payload: LoginPayload):
    account = payload.account
    password = payload.password
    if not account or not password:
        raise HTTPException(400, '缺少帳號或密碼')
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    # 支援 phone 或 email
    cursor.execute('SELECT * FROM users WHERE phone=%s OR email=%s', (account, account))
    user = cursor.fetchone()
    if not user or not user.get('password_hash'):
        raise HTTPException(401, '帳號或密碼錯誤')
    if not verify_password(password, user['password_hash']):
        raise HTTPException(401, '帳號或密碼錯誤')
    # session_id = secrets.token_hex(16)
    # cursor.execute('UPDATE users SET session_id=%s WHERE id=%s', (session_id, user['id']))
    # conn.commit()
    # cursor.close()
    # conn.close()
    token = create_access_token({'user_id': user['id'], 'role': user['role']})
    refresh_token = create_refresh_token({'user_id': user['id'], 'role': user['role']})
    return {'success': True, 'token': token, 'refresh_token': refresh_token, 'user': user}

@router.post('/api/auth/request-reset')
def request_reset(request: Request, payload: ResetPasswordRequest):
    account = payload.account
    if not account:
        raise HTTPException(400, '缺少帳號')
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT * FROM users WHERE phone=%s OR email=%s', (account, account))
    user = cursor.fetchone()
    if not user:
        raise HTTPException(404, '用戶不存在')
    if user.get('phone') == account:
        send_sms(account)
    elif user.get('email') == account:
        code = gen_code()
        set_verify_code(f"email:{account}", code)
        send_email(account, '重設密碼驗證碼', f'您的驗證碼：{code}')
    cursor.close()
    conn.close()
    return {'success': True, 'message': '驗證碼已發送'}

@router.post('/api/auth/reset-password')
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
