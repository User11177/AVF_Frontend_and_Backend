# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests
from bs4 import BeautifulSoup
import re
from collections import defaultdict
from datetime import datetime
from urllib.parse import urljoin



app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

BASE = "https://webreg.edah.org.tw"

@app.get("/api/schedule")
def get_schedule():
    schedule: dict[str, list[dict]] = defaultdict(list)

    # 1) 先抓醫師列表頁
    r = requests.get(f"{BASE}/Register/Doctors/05", timeout=10)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    # 2) 抓每位醫師的 ChooseDoctorTime 連結
    links = soup.find_all(
        "a",
        itemprop="url",
        href=re.compile(r"/Register/ChooseDoctorTime/\d+")
    )

    for a in links:
        # 醫師 code & name
        code = re.search(r"/ChooseDoctorTime/(\d+)", a["href"])[1]
        name_tag = a.find_previous("h2", itemprop="name")
        name = name_tag.get_text(strip=True) if name_tag else "(unknown)"

        # 進入排班頁面
        sched_url = urljoin(BASE, a["href"])
        p = requests.get(sched_url, timeout=10)
        if not p.ok:
            continue
        ps = BeautifulSoup(p.text, "html.parser")

        # 3) 讀 OKflag 按鈕
        for btn in ps.find_all("a", class_=re.compile(r"\bdoctor_btn\b")):
            href = btn.get("href", "")
            if "/Register/OKflag" not in href:
                continue
            full_url = urljoin(BASE, href)

            # 從 href 拆出 OpdDate
            m_opd = re.search(r"OpdDate=(\d+)", href)
            if not m_opd:
                continue
            opd = m_opd[1]  # e.g. "1140528"
            yy, mm, dd = opd[:3], opd[3:5], opd[5:7]
            date_key = f"{1911+int(yy)}-{mm}-{dd}"

            # 院區、科別、時段文字
            hosp_div = btn.find("div", class_=re.compile(r"tag"))
            hospital = hosp_div.get_text(strip=True) if hosp_div else ""
            dept_div = btn.find("div", class_="main")
            dept = dept_div.get_text(strip=True) if dept_div else ""
            time_div = btn.find("div", class_="fontsize4")
            shiftText = time_div.get_text(strip=True) if time_div else ""

            # 狀態
            status = "full" if "disable" in btn.get("class", []) else "available"

            # 收集（不再帶 registered）
            schedule[date_key].append({
                "name":       name,
                "code":       code,
                "hospital":   hospital,
                "dept":       dept,
                "shiftText":  shiftText,
                "status":     status,
                "url":        full_url,
            })

    return schedule







#SQL
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import mysql.connector
from mysql.connector import errorcode, IntegrityError

def get_db():
    return mysql.connector.connect(
        host="localhost",
        user="app_user",      # 你的 MySQL 帳號
        password="new_pass",  # 該帳號密碼
        database="app_db"     # 先前建立的資料庫
    )

class User(BaseModel):
    username: str
    password: str

@app.post("/register")
def register(user: User):
    conn = get_db()
    cursor = conn.cursor()
    try:
        # 參數化查詢：%s 佔位，tuple 依序對應
        cursor.execute(
            "INSERT INTO patients (username, password) VALUES (%s, %s)",
            (user.username, user.password)
        )
        conn.commit()
    except IntegrityError as e:
        # MySQL 錯誤碼 ER_DUP_ENTRY = 1062 表示重複
        if e.errno == errorcode.ER_DUP_ENTRY:
            raise HTTPException(status_code=400, detail="帳號已存在")
        else:
            raise HTTPException(status_code=500, detail="資料庫寫入失敗")
    finally:
        cursor.close()
        conn.close()
    return {"message": "註冊成功"}

@app.post("/login")
def login(user: User):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT id FROM patients WHERE username = %s AND password = %s",
        (user.username, user.password)
    )
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    return {"message": "登入成功", "user_id": row["id"]}
