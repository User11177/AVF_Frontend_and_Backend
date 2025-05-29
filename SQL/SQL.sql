-- 0. 清空表格（移除 signals 與 analysis_results）
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS doctor_schedules;
DROP TABLE IF EXISTS users;

-- 1. 建立資料庫 
CREATE DATABASE IF NOT EXISTS app_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE app_db;

-- 2. 建立使用者帳號表（支援病患、醫生、管理員）
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,         -- 帳號
  password VARCHAR(100) NOT NULL,               -- 密碼（建議使用 hash）
  role ENUM('admin', 'doctor', 'patient') NOT NULL, -- 角色類型
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP -- 建立時間
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 建立病患詳細資料表（關聯 users 表）
CREATE TABLE IF NOT EXISTS patients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,                  -- 對應 users.id
  full_name VARCHAR(100) NOT NULL,              -- 姓名
  id_number VARCHAR(20) NOT NULL,               -- 身分證字號
  email VARCHAR(100),                           -- Email
  phone VARCHAR(20),                            -- 電話
  birthdate DATE,                               -- 出生日期
  address TEXT,                                 -- 地址
  emergency_name VARCHAR(100),                  -- 緊急聯絡人稱謂或姓名
  emergency_phone VARCHAR(20),                  -- 緊急聯絡人電話
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 建立醫師班表（後端爬蟲更新資料）
CREATE TABLE IF NOT EXISTS doctor_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,           -- 醫師姓名，如「李宜哲」
  code VARCHAR(10) NOT NULL,            -- 醫師代碼，如「1539」
  hospital VARCHAR(50),                 -- 院區名稱，如「義大醫院」
  dept VARCHAR(50),                     -- 科別名稱，如「腎臟科」
  shift_text VARCHAR(50),              -- 看診時段文字，如「05/27(二)上午診」
  status ENUM('available', 'full') DEFAULT 'available', -- 是否可掛號
  url TEXT,                             -- 掛號連結（完整網址）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 5. 插入測試帳號（admin, doctor, patient）
INSERT IGNORE INTO users (username, password, role) VALUES
  ('admin1', '0000', 'admin'),
  ('doc123', '0000', 'doctor'),
  ('testacc', '0000', 'patient');

-- 6. 插入測試病患資料（關聯上面 patient 帳號）
SET @patient_user_id = (SELECT id FROM users WHERE username = 'testacc');
INSERT IGNORE INTO patients (user_id, full_name, id_number,email, phone, birthdate, address, emergency_name, emergency_phone)
VALUES (@patient_user_id, '測試患者','A123456789', 'test@mail.com', '0912345678', '1999-01-01', '高雄市xxxxxx', '媽媽', '0912123456');

-- 7. 檢查表與資料
USE app_db;
SHOW TABLES;
SELECT * FROM users;
SELECT * FROM patients;
SELECT COUNT(*) FROM doctor_schedules;
SELECT * FROM doctor_schedules LIMIT 10;

SELECT * FROM doctor_schedules;
