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
  mrn VARCHAR(32), 
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

-- 5. 量測檔案中繼資料（音訊/震動 檔案與屬性）
CREATE TABLE IF NOT EXISTS measurements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  mrn VARCHAR(32) NOT NULL,
  position TINYINT NOT NULL, -- 1/2/3
  mode ENUM('audio','vib','both') NOT NULL,
  audio_path TEXT,
  audio_size INT,
  vib_path TEXT,
  vib_size INT,
  duration_sec INT,
  captured_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. 分析結果（可用性/前處理/模型推論 結果記錄）
CREATE TABLE IF NOT EXISTS analysis_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  measurement_id INT NOT NULL,
  analysis ENUM('audio','vib','fusion') NOT NULL,
  result ENUM('good','bad') NOT NULL,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (measurement_id) REFERENCES measurements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. 聊天室表
CREATE TABLE IF NOT EXISTS chat_rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  title VARCHAR(255),                           -- 聊天室標題
  status ENUM('active', 'closed') DEFAULT 'active',  -- 聊天室狀態
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_patient (patient_id)       -- 每個病患只有一個聊天室
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. 聊天訊息表
CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  chat_room_id INT NOT NULL,
  sender_id INT NOT NULL,
  sender_role ENUM('patient', 'doctor') NOT NULL,  -- 發送者角色
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_chat_room_time (chat_room_id, created_at),
  INDEX idx_sender_role (sender_id, sender_role),
  INDEX idx_read_status (is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

 

 
-- 6. 查詢（測試用）
USE app_db;
SHOW TABLES;
SELECT * FROM users;
SELECT * FROM doctor_schedules LIMIT 10;
SELECT * FROM announcements LIMIT 10;
SELECT * FROM analysis_results;
SELECT * FROM chat_messages;
SELECT * FROM chat_rooms;

INSERT INTO users 
(phone, email, password_hash, google_id, line_id, apple_id, role, full_name, id_number, mrn, birthdate, address, emergency_name, emergency_phone, email_verified, phone_verified)
VALUES
('0911222333', 'user1@mail.com', '$2b$12$examplehashpassword1234567890', NULL, NULL, NULL, 'patient', '王小明', 'A123456789', 'MRN0007', '1998-04-12', '台中市北區進化路200號', '父親', '0922333444', TRUE, TRUE);



#DELETE FROM analysis_results;
#ALTER TABLE analysis_results AUTO_INCREMENT = 1;
#DELETE FROM measurements;
#ALTER TABLE measurements AUTO_INCREMENT = 1;
#DROP TABLE IF EXISTS chat_messages;
#DROP TABLE IF EXISTS chat_rooms;
