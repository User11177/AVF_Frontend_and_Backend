// appgol_config.ts
// 應用程式配置文件 - 集中管理前端設定
// 主要用於設定 API 伺服器的基礎 URL

/**
 * API 伺服器基礎 URL 設定
 * 
 * 開發環境與正式環境的切換：
 * - 開發/測試：使用 ngrok 隧道 URL (方便本地測試)
 * - 正式環境：使用實際域名 (avfcare.com)
 * 
 * 注意：
 * 1. ngrok URL 每次重啟都會改變，需要更新
 * 2. 正式上線時記得切換到正式域名
 * 3. 確保後端 CORS 設定包含此 URL
 * 
 * ⚠️ 重要：如果遇到連線問題，請檢查 ngrok 是否還在運行
 * 並更新為新的隧道 URL
 */

// 正式環境 URL (上線時使用)
// export const API_URL = 'https://avfcare.com';    

// 開發環境 URL (目前使用 ngrok 隧道)
export const API_URL = "https://b7ae1d4d628d.ngrok-free.app";
