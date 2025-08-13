-- 0. 清空所有表
DROP TABLE IF EXISTS doctor_schedules;
DROP TABLE IF EXISTS announcements;
DROP TABLE IF EXISTS users;

-- 1. 建立資料庫
CREATE DATABASE IF NOT EXISTS app_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE app_db;

-- 2. 一張 users 表（純手機/Email驗證碼登入）
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) UNIQUE,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),   -- 密碼 (hash 過)
  google_id VARCHAR(64) UNIQUE,
  line_id VARCHAR(64) UNIQUE,
  apple_id VARCHAR(64) UNIQUE,
  role ENUM('admin', 'doctor', 'patient') NOT NULL DEFAULT 'patient',
  full_name VARCHAR(100),
  id_number VARCHAR(20),
  birthdate DATE,
  address TEXT,
  emergency_name VARCHAR(100),
  emergency_phone VARCHAR(20),
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 醫師班表照常
CREATE TABLE IF NOT EXISTS doctor_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) NOT NULL,
  hospital VARCHAR(50),
  dept VARCHAR(50),
  shift_text VARCHAR(50),
  status ENUM('available', 'full') DEFAULT 'available',
  url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 公告表照常
CREATE TABLE IF NOT EXISTS announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  publisher_id INT,
  FOREIGN KEY (publisher_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. 插入測試用戶（admin, doctor, patient）
INSERT INTO users
  (phone, email, role, full_name, id_number, birthdate, address, emergency_name, emergency_phone, email_verified, phone_verified)
VALUES
  ('0911111111', 'admin1@mail.com', 'admin', '系統管理員', NULL, NULL, NULL, NULL, NULL, TRUE, TRUE),
  ('0922222222', 'doc123@mail.com', 'doctor', '王醫師', NULL, NULL, NULL, NULL, NULL, FALSE, TRUE),
  ('0981900277', 'test@mail.com', 'patient', '測試患者', 'A123456789', '1999-01-01', '高雄市xxxxxx', '媽媽', '0912123456', FALSE, TRUE);
UPDATE users SET email = 'a0981900277a@gmail.com' WHERE id = 1;
-- 6. 查詢（測試用）
SHOW TABLES;
SELECT * FROM users;
SELECT * FROM doctor_schedules LIMIT 10;
SELECT * FROM announcements LIMIT 10;
