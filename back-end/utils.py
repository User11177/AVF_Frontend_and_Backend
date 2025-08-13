# utils.py
# 共用工具：加密、寄信、產驗證碼、密碼雜湊等
from argon2 import PasswordHasher
import secrets
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests as pyrequests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os
from twilio.rest import Client
import jwt, time, os
from fastapi import HTTPException, Request, Depends
from functools import wraps
from config import JWT_SECRET, JWT_ALGO, ACCESS_TOKEN_EXPIRE, REFRESH_TOKEN_EXPIRE, GMAIL_USER, GMAIL_PASS, TWILIO_SID, TWILIO_TOKEN, TWILIO_VERIFY_SID, AES_KEY, VERIFY_CODE_TTL

ph = PasswordHasher()

# 密碼 hash
def hash_password(pw):
    return ph.hash(pw)

def verify_password(pw, hashed):
    try:
        return ph.verify(hashed, pw)
    except Exception:
        return False

# 驗證碼產生
def gen_code(length=6):
    return ''.join(secrets.choice(string.digits) for _ in range(length))

import time
verify_codes = {}

def set_verify_code(key, code):
    verify_codes[key] = (code, time.time() + VERIFY_CODE_TTL)

def check_verify_code(key, code):
    v = verify_codes.get(key)
    if not v:
        return False
    code_saved, expire = v
    if time.time() > expire:
        return False
    if code_saved != code:
        return False
    return True

# Email 寄送
def send_email(to, subject, body):
    msg = MIMEMultipart()
    msg['From'] = GMAIL_USER
    msg['To'] = to
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))
    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
        server.login(GMAIL_USER, GMAIL_PASS)
        server.send_message(msg)

# SMS 寄送（Twilio）
def format_tw_phone(phone: str) -> str:
    # 將 09xxxxxxxx 轉成 +8869xxxxxxxx
    if phone.startswith('09') and len(phone) == 10:
        return '+886' + phone[1:]
    # 已經是 +8869xxxxxxxx
    if phone.startswith('+886') and len(phone) == 13:
        return phone
    # 已經是 8869xxxxxxxx（沒有 +）
    if phone.startswith('886') and len(phone) == 12:
        return '+' + phone
    raise ValueError('手機格式錯誤，請輸入09xxxxxxxx')

def send_sms(phone):
    print("[send_sms] TWILIO_VERIFY_SID:", TWILIO_VERIFY_SID)
    client = Client(TWILIO_SID, TWILIO_TOKEN)
    phone = format_tw_phone(phone)
    # Twilio 會自動產生驗證碼，這裡不會有自產驗證碼
    print("[send_sms] (Twilio) 驗證碼由 Twilio 自動產生")
    verification = client.verify.services(TWILIO_VERIFY_SID).verifications.create(
        to=phone,
        channel='sms'
    )
    return verification.status

def verify_sms(phone, code):
    print("[verify_sms] TWILIO_VERIFY_SID:", TWILIO_VERIFY_SID)
    print(f"[verify_sms] (Twilio) 用戶輸入驗證碼: {code}")
    client = Client(TWILIO_SID, TWILIO_TOKEN)
    phone = format_tw_phone(phone)
    verification_check = client.verify.services(TWILIO_VERIFY_SID).verification_checks.create(
        to=phone,
        code=code
    )
    print(f"[verify_sms] (Twilio) 驗證結果: {verification_check.status}")
    return verification_check.status == 'approved'

 
# AES-256-GCM 加解密
def encrypt_field(plain: str) -> str:
    aesgcm = AESGCM(AES_KEY)
    nonce = secrets.token_bytes(12)
    ct = aesgcm.encrypt(nonce, plain.encode(), None)
    return (nonce + ct).hex()
def decrypt_field(cipher_hex: str) -> str:
    aesgcm = AESGCM(AES_KEY)
    raw = bytes.fromhex(cipher_hex)
    nonce, ct = raw[:12], raw[12:]
    return aesgcm.decrypt(nonce, ct, None).decode()

# JWT 產生/驗證

def create_access_token(data):
    payload = data.copy()
    payload['exp'] = int(time.time()) + ACCESS_TOKEN_EXPIRE
    payload['type'] = 'access'
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def create_refresh_token(data):
    payload = data.copy()
    payload['exp'] = int(time.time()) + REFRESH_TOKEN_EXPIRE
    payload['type'] = 'refresh'
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def decode_token(token, type='access'):
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        if data.get('type') != type:
            return None
        return data
    except Exception:
        return None

# 權限 decorator
def get_current_user(role=None):
    async def dependency(request: Request):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        data = decode_token(token, 'access')
        if not data or (role and data.get('role') != role):
            raise HTTPException(status_code=401, detail='未授權')
        return data
    return dependency
