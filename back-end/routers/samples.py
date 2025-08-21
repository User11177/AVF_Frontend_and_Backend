from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.responses import JSONResponse
from utils import get_current_user
from db import get_db
from pathlib import Path
from datetime import datetime
from typing import Tuple

router = APIRouter()

UPLOAD_ROOT = Path("uploads")
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

def save_upload(file: UploadFile, subdir: Path, filename: str) -> Tuple[str, int]:
    subdir.mkdir(parents=True, exist_ok=True)
    path = subdir / filename
    with path.open("wb") as f:
        f.write(file.file.read())
    size = path.stat().st_size
    return str(path), size

@router.post("/api/samples/upload")
async def upload_sample(
    mrn: str = Form(...),
    position: int = Form(...),          # 1/2/3
    mode: str = Form(...),              # audio | vib | both
    captured_at: str = Form(None),      # ISO 字串
    duration_sec: int = Form(30),
    audio: UploadFile = File(None),
    vibration: UploadFile = File(None),
    user=Depends(get_current_user())
):
    # 驗證 mode 是否為 audio、vib 或 both
    if mode not in ("audio","vib","both"):
        raise HTTPException(400, "mode 必須為 audio/vib/both")
    # 驗證 position 是否為 1、2 或 3
    if position not in (1,2,3):
        raise HTTPException(400, "position 必須為 1/2/3")

    # 設定上傳目錄
    subdir = UPLOAD_ROOT / mrn
    audio_path = None; audio_size = None
    vib_path = None; vib_size = None

    # 如果有音頻文件，保存到指定目錄
    if audio:
        ts = datetime.now().strftime("%Y%m%d%H%M%S")
        name = f"{mrn}-{ts}-{position}.m4a"
        audio_path, audio_size = save_upload(audio, subdir, name)
    # 如果有振動文件，保存到指定目錄
    if vibration:
        ts = datetime.now().strftime("%Y%m%d%H%M%S")
        name = f"{mrn}-{ts}-{position}.txt"
        vib_path, vib_size = save_upload(vibration, subdir, name)

    # 將測量數據插入資料庫
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO measurements (user_id, mrn, position, mode, audio_path, audio_size, vib_path, vib_size, duration_sec, captured_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        user["user_id"], mrn, position, mode,
        audio_path, audio_size, vib_path, vib_size,
        duration_sec,
        (datetime.fromisoformat(captured_at.replace('Z', '+00:00')).strftime("%Y-%m-%d %H:%M:%S") if captured_at else datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S"))
    ))
    conn.commit()
    mid = cursor.lastrowid
    cursor.close(); conn.close()
    # 返回成功信息和測量 ID
    return {"success": True, "measurement_id": mid, "audio_path": audio_path, "vib_path": vib_path}

@router.post("/api/samples/analyze")
async def analyze_sample(
    measurement_id: int = Form(...),
    analysis: str = Form("fusion"),   # audio | vib | fusion
    user=Depends(get_current_user())
):
    # 從資料庫中獲取測量數據
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM measurements WHERE id=%s", (measurement_id,))
    m = cursor.fetchone()
    # 驗證測量是否存在且屬於當前用戶
    if not m or m["user_id"] != user["user_id"]:
        cursor.close(); conn.close()
        raise HTTPException(404, "measurement 不存在")
    # 假值規則：檢查音頻和振動文件的大小
    audio_size = m.get("audio_size") or 0
    vib_size = m.get("vib_size") or 0
    #字節數eg int(1)=1個字節
    is_bad = (audio_size > 50000) or (vib_size > 20000)
    result = "bad" if is_bad else "good"
    details = f"audio_size={audio_size}, vib_size={vib_size}, analysis={analysis}"

    # 將分析結果插入資料庫
    cursor2 = conn.cursor()
    cursor2.execute("""
      INSERT INTO analysis_results (measurement_id, analysis, result, details)
      VALUES (%s,%s,%s,%s)
    """, (measurement_id, analysis, result, details))
    conn.commit()
    cursor2.close(); cursor.close(); conn.close()
    # 返回分析結果
    return {"success": True, "measurement_id": measurement_id, "analysis": analysis, "result": result, "details": details}


