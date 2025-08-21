// index.tsx
// 應用程式主登入頁面 - 用戶身份驗證的入口
// 支援帳號密碼登入和 Google OAuth 第三方登入

import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Alert, ActivityIndicator, Image 
} from 'react-native';
import { API_URL } from '../utils/appgol_config';              // API 基礎 URL
import AsyncStorage from '@react-native-async-storage/async-storage'; // 本地儲存
import { useRouter } from 'expo-router';                      // 路由導航
import * as Google from 'expo-auth-session/providers/google'; // Google 登入
import * as WebBrowser from 'expo-web-browser';              // 瀏覽器支援

/**
 * 登入頁面主元件
 * 
 * 功能特色：
 * 1. 帳號密碼登入 (支援手機號碼或 Email)
 * 2. Google OAuth 第三方登入
 * 3. 自動 token 儲存和路由導向
 * 4. 載入狀態和錯誤處理
 */
export default function Login() {
  // === 狀態管理 ===
  const [account, setAccount] = useState('');    // 帳號 (手機或Email)
  const [password, setPassword] = useState('');  // 密碼
  const [loading, setLoading] = useState(false); // 載入狀態
  const router = useRouter();                    // 路由實例

  // === Google OAuth 設定 ===
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '794306785311-lrr23m7g6fv43vibr8nebteqdas9ipj2.apps.googleusercontent.com',  // Google 客戶端 ID
    // 使用 Expo 的認證服務
    redirectUri: 'https://auth.expo.io/@user1117/rnProject',
    scopes: ['openid', 'profile', 'email'],                  // 要求的權限範圍
    // 使用 ID Token 模式
    responseType: 'id_token'
  });
  WebBrowser.maybeCompleteAuthSession();  // 完成 OAuth 會話





  // === Google OAuth 回應處理 ===
  useEffect(() => {
    /**
     * 處理 Google OAuth 回應
     * 使用 ID Token 模式，直接處理登入
     */
    if (response?.type === 'success') {
      console.log('[Google OAuth] 登入成功，處理 id_token...');
      
      // 取得 Google 提供的 ID Token
      const id_token = (response.authentication as any)?.idToken || (response.authentication as any)?.id_token;
      
      if (id_token) {
        setLoading(true);
        
        // 將 Google ID Token 發送到後端驗證
        fetch(`${API_URL}/api/auth/google-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token })
        })
          .then(res => res.json())
          .then(async data => {
            if (data.success) {
              // === 儲存登入資訊到本地 ===
              await AsyncStorage.setItem('access_token', data.token);
              await AsyncStorage.setItem('refresh_token', data.refresh_token || '');
              
              // 儲存用戶基本資訊
              await AsyncStorage.setItem('user_id', String(data.user.id || ''));
              await AsyncStorage.setItem('user_phone', data.user.phone || '');
              await AsyncStorage.setItem('user_email', data.user.email || '');
              await AsyncStorage.setItem('user_id_number', data.user.id_number || '');
              await AsyncStorage.setItem('user_birthdate', data.user.birthdate || '');
              
              Alert.alert('Google 登入成功！');
              
              // === 根據用戶角色導向不同頁面 ===
              if (data.user.role === 'admin') {
                router.replace('/admin/bot');
              } else if (data.user.role === 'doctor') {
                router.replace('/doctor/doctor');
              } else {
                router.replace('/user/patient');
              }
            } else {
              Alert.alert('錯誤', data.message || 'Google 登入失敗');
            }
          })
          .catch((error) => {
            console.error('[Google OAuth] 請求失敗:', error);
            Alert.alert('錯誤', 'Google 登入失敗');
          })
          .finally(() => setLoading(false));
      } else {
        Alert.alert('錯誤', '無法獲取 Google ID Token');
      }
    } else if (response?.type === 'error') {
      console.log('[Google OAuth] 錯誤:', response.error);
      Alert.alert('Google 登入錯誤', response.error?.message || '登入失敗');
    } else if (response?.type === 'dismiss') {
      console.log('[Google OAuth] 用戶取消登入');
    }
  }, [response]);

  // === 傳統帳號密碼登入 ===
  const handleLogin = async () => {
    /**
     * 處理帳號密碼登入流程
     * 
     * 流程：
     * 1. 驗證輸入欄位
     * 2. 發送登入請求到後端
     * 3. 儲存 JWT tokens 和用戶資訊
     * 4. 根據角色導向對應頁面
     */
    
    // 輸入驗證
    if (!account) return Alert.alert('請輸入手機號碼或 Email');
    if (!password) return Alert.alert('請輸入密碼');
    
    setLoading(true);
    
    // 發送登入請求
    fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account, password })
    })
      .then(res => res.json())
      .then(async data => {
        if (data.success) {
          // === 儲存認證資訊 ===
          await AsyncStorage.setItem('access_token', data.token);           // JWT 存取令牌
          if (data.refresh_token) {
            await AsyncStorage.setItem('refresh_token', data.refresh_token); // JWT 刷新令牌
          }
          
          // 除錯輸出
          console.log('[Login] Token 儲存成功');
          console.log('[Login] Access Token Length:', data.token ? data.token.length : 0);
          console.log('[Login] Access Token:', data.token);
          console.log('[Login] User ID:', data.user.id);
          
          // === 儲存用戶資訊 ===
          await AsyncStorage.setItem('user_id', String(data.user.id || ''));
          await AsyncStorage.setItem('user_phone', data.user.phone || '');
          await AsyncStorage.setItem('user_email', data.user.email || '');
          await AsyncStorage.setItem('user_id_number', data.user.id_number || '');
          await AsyncStorage.setItem('user_birthdate', data.user.birthdate || '');
          await AsyncStorage.setItem('user_mrn', data.user.mrn || '');      // 病歷號
          
          Alert.alert('登入成功');
          
          // === 角色導向 ===
          if (data.user.role === 'admin') {
            router.replace('/admin/bot');        // 管理員 → 管理介面
          } else if (data.user.role === 'doctor') {
            router.replace('/doctor/doctor');    // 醫師 → 醫師介面
          } else {
            router.replace('/user/patient');     // 病患 → 病患介面
          }
        } else {
          Alert.alert('錯誤', data.message || '登入失敗');
        }
      })
      .catch(() => Alert.alert('錯誤', '登入失敗'))
      .finally(() => setLoading(false));
  };

  /**
   * 觸發 Google OAuth 登入流程
   */
  const handleGoogleLogin = () => {
    promptAsync();  // 開啟 Google 登入視窗
  };

  // === UI 渲染 ===
  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        {/* 頁面標題 */}
        <Text style={styles.header}>登入</Text>
        
        {/* 帳號輸入框 (支援手機號碼或 Email) */}
        <TextInput
          style={styles.input}
          placeholder="手機號碼或 Email"
          value={account}
          onChangeText={setAccount}
          autoCapitalize="none"      // 不自動大寫
          keyboardType="default"     // 預設鍵盤
        />
        
        {/* 密碼輸入框 */}
        <TextInput
          style={styles.input}
          placeholder="密碼"
          value={password}
          onChangeText={setPassword}
          secureTextEntry            // 隱藏密碼輸入
        />
        
        {/* 登入按鈕 (帶載入狀態) */}
        <TouchableOpacity 
          style={styles.btn} 
          onPress={handleLogin} 
          disabled={loading}        // 載入時禁用按鈕
        >
          {loading ? 
            <ActivityIndicator color="#fff" /> : 
            <Text style={styles.btnText}>登入</Text>
          }
        </TouchableOpacity>
        
        {/* 功能連結 */}
        <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/reset-password')}>
          <Text style={styles.linkText}>忘記密碼？</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/register')}>
          <Text style={styles.linkText}>註冊新帳號</Text>
        </TouchableOpacity>
        
        
        {/* 分隔線 */}
        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.orText}>或</Text>
          <View style={styles.divider} />
        </View>
        <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleLogin}>
          <View style={styles.googleRow}>
            <Image
              source={require('../assets/images/google.png')}
              style={styles.googleIcon}
            />
            <Text style={styles.googleText}>使用 Google 繼續</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#EEF1F7', justifyContent: 'center', alignItems: 'center' },
  card: {
    width: '95%',
    maxWidth: 370,
    backgroundColor: '#fff',
    padding: 28,
    borderRadius: 20,
    shadowColor: "#333",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 7,
    alignItems: 'center'
  },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 22, color: '#222' },
  input: {
    width: '100%', backgroundColor: '#F5F7FB', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#E0E5EF', marginBottom: 12, fontSize: 16
  },
  btn: {
    width: '100%', backgroundColor: '#007AFF', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4
  },
  btnText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  linkBtn: { marginTop: 10 },
  linkText: { color: '#007AFF', fontSize: 15, textAlign: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 22, alignSelf: 'stretch' },
  divider: { flex: 1, height: 1, backgroundColor: '#e0e0e0' },
  orText: { marginHorizontal: 12, color: '#aaa', fontSize: 15 },
  googleBtn: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    width: '100%',
    paddingVertical: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  googleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  googleIcon: { width: 24, height: 24, marginRight: 8 },
  googleText: { fontSize: 17, color: '#222', fontWeight: '500' }
});
