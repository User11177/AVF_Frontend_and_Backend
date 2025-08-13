# 使用官方 Python 基底映像
FROM python:3.10
#pip
#RUN pip install FastAPI CORSMiddleware requests BeautifulSoup mysql.connector threading time

# 設定工作目錄
WORKDIR /app

# 複製 requirements（如果有 requirements.txt）或先複製全部
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 複製後端所有檔案
COPY . .

# 開放 port
EXPOSE 8000

# 啟動指令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
