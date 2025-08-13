from collections import defaultdict
import re
import datetime
from db import get_db
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from fastapi import APIRouter
from loguru import logger

router = APIRouter()

@router.get("/schedule/refresh")
def refresh_schedule():
    try:
        BASE = "https://webreg.edah.org.tw"
        schedule = defaultdict(list)
        logger.info("🔄 開始抓取醫師清單...")
        r = requests.get(f"{BASE}/Register/Doctors/05", timeout=10)
        soup = BeautifulSoup(r.text, "html.parser")
        links = soup.find_all("a", itemprop="url", href=re.compile(r"/Register/ChooseDoctorTime/\d+"))
        logger.info(f"✅ 共抓到 {len(links)} 位醫師")
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM doctor_schedules")
        rows_affected = 0
        for a in links:
            try:
                code = re.search(r"/ChooseDoctorTime/(\d+)", a["href"])[1]
                name_tag = a.find_previous("h2", itemprop="name")
                name = name_tag.get_text(strip=True) if name_tag else "(unknown)"
                logger.info(f"→ 醫師：{name} ({code})")
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
                logger.error(f"❌ 發生錯誤：{e}")
        conn.commit()
        cursor.close()
        conn.close()
        logger.info(f"✅ 寫入 SQL 完成，共新增 {rows_affected} 筆排班資料")
        return {"message": f"共新增 {rows_affected} 筆排班資料"}
    except Exception as e:
        logger.error(f"❌ 排程主體錯誤：{e}")
        return {"error": str(e)}

@router.get("/schedule")
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
        date_key = f"{datetime.datetime.now().year}-{mm}-{dd}"
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
