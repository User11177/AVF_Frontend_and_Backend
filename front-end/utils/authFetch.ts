// authFetch.ts
// 前端認證工具 - 處理 JWT token 自動刷新和 API 請求
// 提供自動化的身份驗證機制，確保用戶會話的連續性

import AsyncStorage from '@react-native-async-storage/async-storage';  // 本地儲存
import { API_URL } from './appgol_config';                           // API 基礎 URL
import { Alert } from 'react-native';                                // 彈窗提示
import { router } from 'expo-router';                                // 路由導航

/**
 * 帶有自動認證功能的 fetch 函數
 * 
 * 功能 ：
 * 1. 自動附加 JWT token 到請求頭
 * 2. 當 access token 過期時，自動使用 refresh token 刷新
 * 3. 處理認證失敗的情況，自動導向登入頁面
 * 4. 支援 FormData 和 JSON 兩種請求格式
 * 
 * @param url - 請求的 URL
 * @param options - fetch 選項 (method(
 * 讀資料 → GET
 *新增 → POST
 *全部更新 → PUT
 *部分更新 → PATCH
 *刪除 → DELETE), 
 *body→要送到伺服器的資料,
 * headers→設定資料格式、授權資訊等)
 * @returns Promise(狀態:進行完成成功失敗)
 * <Response>status(狀態碼)-headers - fetch 回應
 */
export async function authFetch(url: string, options: any = {}) {
  // 從本地儲存取得 JWT tokens
  let accessToken = await AsyncStorage.getItem('access_token');
  let refreshToken = await AsyncStorage.getItem('refresh_token');
  
  // 除錯輸出
  console.log('[authFetch] URL:', url);
  console.log('[authFetch] Access Token Length:', accessToken ? accessToken.length : 0);
  console.log('[authFetch] Access Token:', accessToken);
  console.log('[authFetch] Refresh Token Length:', refreshToken ? refreshToken.length : 0);
  console.log('[authFetch] Refresh Token:', refreshToken);
  
  // 建構請求頭
  let headers: any = {
    ...(options.headers || {}),                                    // 保留原有 headers
    'Content-Type': options.body instanceof FormData             // 根據 body 類型設定 Content-Type
      ? undefined                                                 // FormData 讓瀏覽器自動設定
      : 'application/json',                                       // JSON 格式
    ...(accessToken ? { 'Authorization': 'Bearer ' + accessToken } : {}),  // 附加 JWT token  Authorization:授權標頭 +類型Bearer (egBasic=basic64)+憑證
  };
  
  // 套上上面組好的headers執行第一次請求
  let res = await fetch(url, { ...options, headers });
  
  // === JWT Token 自動刷新機制 ===
  // 如果收到 401 (未授權) 且有 refresh token，嘗試刷新 access token
  if (res.status === 401 && refreshToken) {
    const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    //access_token+refresh_token
    const refreshData = await refreshRes.json();

    if (refreshData.access_token) {
      // 刷新成功：更新本地儲存的 access token
      await AsyncStorage.setItem('access_token', refreshData.access_token);
      headers['Authorization'] = 'Bearer ' + refreshData.access_token;
      
      // 使用新的 token 重試原本的請求
      res = await fetch(url, { ...options, headers });
    } else {
      // 刷新失敗：refresh token 也過期了
      handleAuthExpired(refreshData?.detail);
      throw new Error('連線逾時，請重新登入');
    }
  }
  
  // === 最終認證檢查 ===
  // 如果仍然收到 401，表示認證完全失敗
  if (res.status === 401) {
    let msg = '連線逾時，請重新登入';
    try {
      const data = await res.clone().json();
      if (data?.detail && typeof data.detail === 'string') {
        msg = msg;  // 保持預設訊息或使用伺服器提供的錯誤訊息
      }
    } catch {}
    
    handleAuthExpired(msg);
    throw new Error(msg);
  }
  
  return res;  // 回傳成功的回應
}

/**
 * 處理認證過期的情況
 * 
 * 當 JWT token 完全失效時：
 * 1. 顯示提示訊息給用戶
 * 2. 清除本地儲存的所有資料
 * 3. 導向登入頁面重新認證
 * 
 * @param msg - 要顯示給用戶的錯誤訊息
 */
function handleAuthExpired(msg: string) {
  Alert.alert('提示', msg, [
    {
      text: '確定',
      onPress: async () => {
        // 清除所有本地儲存資料
        await AsyncStorage.removeItem('access_token');
        await AsyncStorage.removeItem('refresh_token');
        router.replace('/');         // 導向首頁/登入頁
      }
    }
  ]);
} 