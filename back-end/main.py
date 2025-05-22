from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
from bs4 import BeautifulSoup
import re
from collections import defaultdict
from urllib.parse import urljoin
from datetime import datetime
import mysql.connector
import threading
import time
app = FastAPI()

# CORS 設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 資料庫連線
def get_db():
    return mysql.connector.connect(
        host="127.0.0.1",
        user="app_user",
        password="a921117",
        database="app_db"
    )

# 使用者登入模型
class User(BaseModel):
    username: str
    password: str

# 使用者登入 API
@app.post("/api/login")
def login(user: User):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        "SELECT id, role FROM users WHERE username = %s AND password = %s",
        (user.username, user.password)
    )
    row = cursor.fetchone()

    cursor.close()
    conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")

    return {
        "message": "登入成功",
        "user_id": row["id"],
        "role": row["role"]
    }


# 從 SQL 撈排班資料回傳給前端
@app.get("/api/schedule")
def get_schedule():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM doctor_schedules ORDER BY shift_text")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    schedule = defaultdict(list)
    for row in rows:
        m = re.search(r"(\d{2})/(\d{2})", row["shift_text"])
        if not m:
            continue
        mm, dd = m.groups()
        date_key = f"{datetime.now().year}-{mm}-{dd}"

        schedule[date_key].append({
            "name": row["name"],
            "code": row["code"],
            "hospital": row["hospital"],
            "dept": row["dept"],
            "shiftText": row["shift_text"],
            "status": row["status"],
            "url": row["url"]
        })

    return schedule

# 原本的爬蟲  丟入SQL
@app.get("/api/schedule/refresh")
def refresh_schedule():
    try:
        BASE = "https://webreg.edah.org.tw"
        schedule = defaultdict(list)
        print("🔄 開始抓取醫師清單...")
        r = requests.get(f"{BASE}/Register/Doctors/05", timeout=10)
        soup = BeautifulSoup(r.text, "html.parser")

        links = soup.find_all("a", itemprop="url", href=re.compile(r"/Register/ChooseDoctorTime/\d+"))
        print(f"✅ 共抓到 {len(links)} 位醫師")

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM doctor_schedules")
        rows_affected = 0

        for a in links:
            try:
                code = re.search(r"/ChooseDoctorTime/(\d+)", a["href"])[1]
                name_tag = a.find_previous("h2", itemprop="name")
                name = name_tag.get_text(strip=True) if name_tag else "(unknown)"
                print(f"→ 醫師：{name} ({code})")

                sched_url = urljoin(BASE, a["href"])
                p = requests.get(sched_url, timeout=10)
                ps = BeautifulSoup(p.text, "html.parser")

                for btn in ps.find_all("a", class_="doctor_btn"):
                    href = btn.get("href", "")
                    if "/Register/OKflag" not in href:
                        continue
                    full_url = urljoin(BASE, href)
                    m_opd = re.search(r"OpdDate=(\d+)", href)
                    if not m_opd:
                        continue
                    opd = m_opd[1]
                    yy, mm, dd = opd[:3], opd[3:5], opd[5:7]

                    hosp_div = btn.find("div", class_=re.compile(r"tag"))
                    hospital = hosp_div.get_text(strip=True) if hosp_div else ""
                    dept_div = btn.find("div", class_="main")
                    dept = dept_div.get_text(strip=True) if dept_div else ""
                    time_div = btn.find("div", class_="fontsize4")
                    shift_text = time_div.get_text(strip=True) if time_div else ""
                    status = "full" if "disable" in btn.get("class", []) else "available"

                    cursor.execute("""
                        INSERT INTO doctor_schedules (name, code, hospital, dept, shift_text, status, url)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (name, code, hospital, dept, shift_text, status, full_url))
                    rows_affected += 1
            except Exception as e:
                print(f"❌ 發生錯誤：{e}")

        conn.commit()
        cursor.close()
        conn.close()
        print(f"✅ 寫入 SQL 完成，共新增 {rows_affected} 筆排班資料")
        return {"message": f"共新增 {rows_affected} 筆排班資料"}

    except Exception as e:
        print("❌ 排程主體錯誤：", e)
        return {"error": str(e)}



def schedule_loop():
    while True:
        refresh_schedule()
        time.sleep(600)  # 每 600 秒（10 分鐘）執行一次

# 啟動時自動刷新一次
threading.Thread(target=refresh_schedule).start()






#SQLTO 個人資料

class PatientUpdate(BaseModel):
    full_name: str
    id_number: str
    email: str
    phone: str
    birthdate: str
    address: str
    emergency_name: str
    emergency_phone: str

@app.get("/api/patient/{user_id}")
def get_patient_info(user_id: int):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT u.username, p.full_name,p.id_number, p.email, p.phone, p.birthdate, p.address,
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

@app.put("/api/patient/{user_id}")
def update_patient_info(user_id: int, payload: PatientUpdate):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE patients
        SET full_name=%s,id_number=%s, email=%s, phone=%s, birthdate=%s, address=%s, emergency_name=%s, emergency_phone=%s
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

