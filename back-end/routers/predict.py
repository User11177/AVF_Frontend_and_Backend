from fastapi import APIRouter, UploadFile, File, Depends
from fastapi.responses import JSONResponse
import json
from utils import get_current_user

router = APIRouter()

@router.post("/predict")
async def predict(audio: UploadFile = File(...), vibration: UploadFile = File(...), user=Depends(get_current_user())):
    # 音檔
    audio_bytes = await audio.read()
    # 震動(json)檔
    vib_bytes = await vibration.read()
    try:
        vib_data = json.loads(vib_bytes.decode("utf-8"))
    except:
        vib_data = []
    # ====== 簡單假模型 ======
    audio_size = len(audio_bytes)
    vib_count = len(vib_data)
    if audio_size > 50000 or vib_count > 100:
        status = "堵塞"
        blockage_rate = 0.85
    else:
        status = "正常"
        blockage_rate = 0.10
    return JSONResponse({"status": status, "blockage_rate": blockage_rate}) 