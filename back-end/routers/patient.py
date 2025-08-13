from fastapi import APIRouter, HTTPException, Query, Depends
from models import PatientUpdate
from db import get_db
from utils import get_current_user

router = APIRouter()

# 查詢病患個資
@router.get("/patient/{user_id}")
def get_patient_info(user_id: int, user=Depends(get_current_user())):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT u.username, p.full_name, p.id_number, p.email, p.phone, p.birthdate, p.address,
               p.emergency_name, p.emergency_phone
        FROM patients p
        JOIN users u ON p.user_id = u.id
        WHERE p.user_id = %s
    """, (user_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="找不到病患資料")
    return row

# 更新病患個資
@router.put("/patient/{user_id}")
def update_patient_info(user_id: int, payload: PatientUpdate, user=Depends(get_current_user())):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE patients
        SET full_name=%s, id_number=%s, email=%s, phone=%s, birthdate=%s,
            address=%s, emergency_name=%s, emergency_phone=%s
        WHERE user_id=%s
    """, (
        payload.full_name,
        payload.id_number,
        payload.email,
        payload.phone,
        payload.birthdate,
        payload.address,
        payload.emergency_name,
        payload.emergency_phone,
        user_id
    ))
    conn.commit()
    cursor.close()
    conn.close()
    return {"message": "病患資料已更新"}

# 依身分證查病患
@router.get("/patient/search")
def get_patient(id: str = Query(...), user=Depends(get_current_user())):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM patients WHERE id_number = %s", (id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="找不到此身分證對應的病患")
    return row 