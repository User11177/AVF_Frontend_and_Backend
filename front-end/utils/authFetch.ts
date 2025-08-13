import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './appgol_config';
import { Alert } from 'react-native';
import { router } from 'expo-router';

export async function authFetch(url: string, options: any = {}) {
  let accessToken = await AsyncStorage.getItem('access_token');
  let refreshToken = await AsyncStorage.getItem('refresh_token');
  let headers: any = {
    ...(options.headers || {}),
    'Content-Type': options.body instanceof FormData ? undefined : 'application/json',
    ...(accessToken ? { 'Authorization': 'Bearer ' + accessToken } : {}),
  };
  let res = await fetch(url, { ...options, headers });
  // 若 access token 過期，嘗試 refresh
  if (res.status === 401 && refreshToken) {
    const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    const refreshData = await refreshRes.json();
    if (refreshData.access_token) {
      await AsyncStorage.setItem('access_token', refreshData.access_token);
      headers['Authorization'] = 'Bearer ' + refreshData.access_token;
      // 重試原本請求
      res = await fetch(url, { ...options, headers });
    } else {
      handleAuthExpired(refreshData?.detail);
      throw new Error('連線逾時，請重新登入');
    }
  }
  // 處理 session 驗證失敗或 token 過期
  if (res.status === 401) {
    let msg = '連線逾時，請重新登入';
    try {
      const data = await res.clone().json();
      if (data?.detail && typeof data.detail === 'string') {
        msg = msg;
      }
    } catch {}
    handleAuthExpired(msg);
    throw new Error(msg);
  }
  return res;
}

function handleAuthExpired(msg: string) {
  Alert.alert('提示', msg, [
    {
      text: '確定',
      onPress: async () => {
        await AsyncStorage.clear();
        router.replace('/');  
      }
    }
  ]);
} 