# doctor.py
# 醫師相關路由 - 處理醫師搜尋病患、病歷檢視等功能

from fastapi import APIRouter, HTTPException, Depends, Query
from db import get_db
from utils import get_current_user
from typing import Optional

router = APIRouter()

# 醫師搜尋病患
@router.get("/api/doctor/search-patients")
def search_patients(
    query: str = Query(..., description="搜尋關鍵字：身份證/姓名/病歷號"),
    user=Depends(get_current_user())
):
    """
    醫師搜尋病患功能
    
    支援透過以下方式搜尋：
    - 身份證號碼
    - 姓名（模糊搜尋）
    - 病歷號（MRN）
    """
    # 驗證醫師權限
    if user.get('role') != 'doctor':
        raise HTTPException(status_code=403, detail='只有醫師可以搜尋病患')
    
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    # 多條件搜尋 SQL
    search_sql = """
        SELECT DISTINCT u.id, u.full_name, u.id_number, u.email, u.phone, 
               u.birthdate, u.address, u.emergency_name, u.emergency_phone, u.mrn,
               u.created_at
        FROM users u
        WHERE u.role = 'patient' 
        AND (
            u.id_number LIKE %s OR 
            u.full_name LIKE %s OR 
            u.mrn LIKE %s
        )
        ORDER BY u.created_at DESC
        LIMIT 50
    """
    
    search_term = f"%{query}%"
    cursor.execute(search_sql, (search_term, search_term, search_term))
    patients = cursor.fetchall()
    
    cursor.close()
    conn.close()
    
    return {
        "success": True,
        "data": patients,
        "count": len(patients)
    }

# 取得病患詳細資料（包含檢測記錄）
@router.get("/api/doctor/patient/{patient_id}")
def get_patient_detail(
    patient_id: int,
    user=Depends(get_current_user())
):
    """
    取得病患詳細資料和檢測記錄
    """
    # 驗證醫師權限
    if user.get('role') != 'doctor':
        raise HTTPException(status_code=403, detail='只有醫師可以查看病患詳細資料')
    
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    # 取得病患基本資料
    cursor.execute("""
        SELECT id, full_name, id_number, email, phone, birthdate, address,
               emergency_name, emergency_phone, mrn, created_at
        FROM users
        WHERE id = %s AND role = 'patient'
    """, (patient_id,))
    
    patient = cursor.fetchone()
    if not patient:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail='找不到病患')
    
    # 取得檢測記錄
    cursor.execute("""
        SELECT m.id as measurement_id, m.position, m.mode, m.duration_sec, 
               m.captured_at, m.created_at,
               ar.id as analysis_id, ar.analysis, ar.result, ar.details, ar.created_at as analyzed_at
        FROM measurements m
        LEFT JOIN analysis_results ar ON m.id = ar.measurement_id
        WHERE m.user_id = %s
        ORDER BY m.created_at DESC
    """, (patient_id,))
    
    measurements = cursor.fetchall()
    
    cursor.close()
    conn.close()
    
    return {
        "success": True,
        "patient": patient,
        "measurements": measurements
    }

# 取得檢測詳情
@router.get("/api/doctor/measurement/{measurement_id}")
def get_measurement_detail(
    measurement_id: int,
    user=Depends(get_current_user())
):
    """
    取得單一檢測的詳細資料
    """
    # 驗證醫師權限
    if user.get('role') != 'doctor':
        raise HTTPException(status_code=403, detail='只有醫師可以查看檢測詳情')
    
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    # 取得檢測詳情
    cursor.execute("""
        SELECT m.*, u.full_name as patient_name, u.mrn,
               ar.analysis, ar.result, ar.details, ar.created_at as analyzed_at
        FROM measurements m
        JOIN users u ON m.user_id = u.id
        LEFT JOIN analysis_results ar ON m.id = ar.measurement_id
        WHERE m.id = %s
    """, (measurement_id,))
    
    measurement = cursor.fetchone()
    if not measurement:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail='找不到檢測記錄')
    
    cursor.close()
    conn.close()
    
    return {
        "success": True,
        "data": measurement
    }
