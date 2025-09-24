# 使用Python 3.10作為基礎鏡像
FROM python:3.10-slim

# 設置工作目錄
WORKDIR /app

# 安裝系統依賴
RUN apt-get update && apt-get install -y \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# 複製requirements.txt（從back-end目錄）
COPY back-end/requirements.txt .

# 安裝Python依賴
RUN pip install --no-cache-dir -r requirements.txt

# 複製後端應用代碼
COPY back-end/ .

# 複製SQL文件到指定位置（如果需要的話）
COPY sql/ ./sql/

# 創建日誌目錄
RUN mkdir -p logs

# 暴露端口8000
EXPOSE 8000

# 啟動命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
