from pydantic import BaseModel

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