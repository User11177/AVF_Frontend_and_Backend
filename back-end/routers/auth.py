from fastapi import APIRouter, HTTPException, Depends
from db import get_db
from utils import gen_code, set_verify_code, check_verify_code, send_sms, send_email, create_access_token, create_refresh_token, verify_sms, decode_token, get_current_user, hash_password, verify_password
import secrets
import requests
from models import RegisterSMSPayload, VerifySMSPayload, SetPasswordPayload, LoginPayload, GoogleLoginPayload, ResetPasswordRequest, ResetPasswordVerifyPayload, ResetPasswordPayload

router = APIRouter()

@router.post('/auth/request-otp')
def request_otp(payload: dict):
    phone = payload.get('phone')
    email = payload.get('email')
    if (phone and email) or (not phone and not email):
        raise HTTPException(400, '請只填寫手機或 Email 其中一個')
    if phone:
        send_sms(phone)  # Twilio 會自動產生驗證碼
    if email:
        code = gen_code()
        set_verify_code(f"email:{email}", code)
        send_email(email, '登入驗證碼', f'您的驗證碼：{code}')
    return {'success': True, 'message': '驗證碼已發送'}

@router.post('/auth/verify-otp')
def verify_otp(payload: dict):
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

@router.post('/auth/refresh')
def refresh_token_api(payload: dict):
    refresh_token = payload.get('refresh_token')
    data = decode_token(refresh_token, 'refresh')
    if not data:
        raise HTTPException(401, 'refresh_token 無效或過期')
    new_token = create_access_token({'user_id': data['user_id'], 'role': data['role']})
    return {'access_token': new_token}

@router.post('/auth/google-login')
def google_login(payload: dict):
    id_token = payload.get('id_token')
    if not id_token:
        raise HTTPException(400, '缺少 id_token')
    # 驗證 Google id_token
    google_resp = requests.get(f'https://oauth2.googleapis.com/tokeninfo?id_token={id_token}')
    if google_resp.status_code != 200:
        raise HTTPException(400, 'Google token 驗證失敗')
    google_data = google_resp.json()
    email = google_data.get('email')
    google_id = google_data.get('sub')
    if not email or not google_id:
        raise HTTPException(400, 'Google token 缺少 email 或 sub')
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    # 1. 先用 google_id 查找
    cursor.execute('SELECT * FROM users WHERE google_id=%s', (google_id,))
    user = cursor.fetchone()
    # 2. 若無，再用 email 查找，並補上 google_id
    if not user:
        cursor.execute('SELECT * FROM users WHERE email=%s', (email,))
        user = cursor.fetchone()
        if user:
            # 若該帳號已綁定其他 google_id，不允許重複綁定
            if user.get('google_id') and user['google_id'] != google_id:
                raise HTTPException(400, '此 email 已綁定其他 Google 帳號')
            cursor.execute('UPDATE users SET google_id=%s, email_verified=TRUE WHERE id=%s', (google_id, user['id']))
            conn.commit()
            cursor.execute('SELECT * FROM users WHERE id=%s', (user['id'],))
            user = cursor.fetchone()
    # 3. 若都沒有，新增用戶
    if not user:
        cursor.execute('INSERT INTO users (email, google_id, email_verified) VALUES (%s, %s, TRUE)', (email, google_id))
        conn.commit()
        cursor.execute('SELECT * FROM users WHERE google_id=%s', (google_id,))
        user = cursor.fetchone()
    # 產生新 session_id
    # import secrets
    # session_id = secrets.token_hex(16)
    # cursor.execute('UPDATE users SET session_id=%s WHERE id=%s', (session_id, user['id']))
    # conn.commit()
    cursor.close()
    conn.close()
    # 產生 token
    token = create_access_token({'user_id': user['id'], 'role': user['role']})
    refresh_token = create_refresh_token({'user_id': user['id'], 'role': user['role']})
    return {'success': True, 'token': token, 'refresh_token': refresh_token, 'user': user}

@router.post('/auth/logout')
def logout(user=Depends(get_current_user())):
    # conn = get_db()
    # cursor = conn.cursor()
    # cursor.execute('UPDATE users SET session_id=NULL WHERE id=%s', (user['user_id'],))
    # conn.commit()
    # cursor.close()
    # conn.close()
    return {'success': True, 'message': '已登出'}

@router.post('/auth/set-password')
def set_password(payload: SetPasswordPayload):
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

@router.post('/auth/login')
def login(payload: LoginPayload):
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

@router.post('/auth/request-reset')
def request_reset(payload: ResetPasswordRequest):
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

@router.post('/auth/reset-password')
def reset_password(payload: ResetPasswordPayload):
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
