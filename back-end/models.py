from __future__ import annotations
from pydantic import BaseModel
from typing import List, Optional

#0
class RegisterSMSPayload(BaseModel):
    phone: str
#0
class VerifySMSPayload(BaseModel):
    phone: str
    code: str

class SetPasswordPayload(BaseModel):
    phone: str
    password: str

class LoginPayload(BaseModel):
    account: str  # phone or email
    password: str
#0
class GoogleLoginPayload(BaseModel):
    id_token: str

class ResetPasswordRequest(BaseModel):
    account: str  # phone or email
#0
class ResetPasswordVerifyPayload(BaseModel):
    account: str
    code: str

class ResetPasswordPayload(BaseModel):
    account: str
    code: str
    new_password: str

class VerifyEmailPayload(BaseModel):
    email: str
    code: str

class VerifyPhonePayload(BaseModel):
    phone: str
    code: str

class PatientUpdate(BaseModel):
    full_name: str
    id_number: str
    email: str
    phone: str
    birthdate: str
    address: str
    emergency_name: str
    emergency_phone: str

class CreateUserPayload(BaseModel):
    full_name: str = None
    role: str = 'patient'
    id_number: str = None
    mrn: str = None
    phone: str = None
    email: str = None
    password: str = None
    password_hash: str = None
    birthdate: str = None
    address: str = None
    emergency_name: str = None
    emergency_phone: str = None
    email_verified: int = 0
    phone_verified: int = 0

class UpdateUserPayload(BaseModel):
    full_name: str = None
    role: str = None
    id_number: str = None
    mrn: str = None
    phone: str = None
    email: str = None
    password: str = None
    password_hash: str = None
    birthdate: str = None
    address: str = None
    emergency_name: str = None
    emergency_phone: str = None
    email_verified: int = None
    phone_verified: int = None

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    publisher_id: int

class AnnouncementUpdate(BaseModel):
    title: str
    content: str

class HealthInfo(BaseModel):
    id: int
    title: str
    content: str
    updated_at: str

# ============================================================================
# 管理員功能相關模型
# ============================================================================

class MaintenanceToggle(BaseModel):
    """維護模式切換請求模型"""
    maintenance: bool

class SystemHealthStatus(BaseModel):
    """系統健康狀態模型"""
    api: bool
    db: bool
    uploads_writable: bool

class UserStatistics(BaseModel):
    """用戶統計模型"""
    admin_count: int
    doctor_count: int
    patient_count: int
    total_users: int
    last_updated: str

class ErrorLogItem(BaseModel):
    """錯誤日誌項目模型"""
    error_code: str
    count: int
    last_occurred: str
    description: Optional[str] = None

class ErrorLogsData(BaseModel):
    """錯誤日誌回應模型"""
    total_errors: int
    top_errors: List[ErrorLogItem]
    last_updated: str

class MaintenanceStatus(BaseModel):
    """維護模式狀態模型"""
    enabled: bool
    last_updated: Optional[str] = None
    updated_by: Optional[int] = None 