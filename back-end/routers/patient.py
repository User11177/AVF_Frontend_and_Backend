from fastapi import APIRouter, HTTPException, Query, Depends
from models import PatientUpdate
from db import get_db
from utils import get_current_user

router = APIRouter()

# 取得病患自己的檢測記錄 - 必須放在 {user_id} 路由之前
@router.get("/api/patient/my-records")
def get_my_medical_records(user=Depends(get_current_user())):
    """
    取得當前病患的檢測記錄
    只允許病患查看自己的記錄
    """
    user_id = user.get('user_id')
    user_role = user.get('role')
    
    # 驗證病患權限
    if user_role != 'patient':
        raise HTTPException(status_code=403, detail='只有病患可以查看自己的檢測記錄')
    
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    # 取得檢測記錄
    cursor.execute("""
        SELECT m.id as measurement_id, m.position, m.mode, m.duration_sec, 
               m.captured_at, m.created_at,
               ar.id as analysis_id, ar.analysis, ar.result, ar.details, ar.created_at as analyzed_at
        FROM measurements m
        LEFT JOIN analysis_results ar ON m.id = ar.measurement_id
        WHERE m.user_id = %s
        ORDER BY m.created_at DESC
    """, (user_id,))
    
    measurements = cursor.fetchall()
    
    cursor.close()
    conn.close()
    
    return {
        "success": True,
        "measurements": measurements,
        "count": len(measurements)
    }

# 依身分證查病患
@router.get("/api/patient/search")
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

# 查詢病患個資
@router.get("/api/patient/{user_id}")
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
@router.put("/api/patient/{user_id}")
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