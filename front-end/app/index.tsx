// index.tsx
// 應用程式主登入頁面 - 用戶身份驗證的入口
// 支援帳號密碼登入和 Google OAuth 第三方登入

// ✅ WebBrowser 初始化放在模組頂層，避免重複初始化
import * as WebBrowser from 'expo-web-browser';
WebBrowser.maybeCompleteAuthSession();

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Alert, ActivityIndicator, Image, Platform 
} from 'react-native';
import { API_URL } from '../utils/appgol_config';              // API 基礎 URL
import AsyncStorage from '@react-native-async-storage/async-storage'; // 本地儲存
import { useRouter } from 'expo-router';                      // 路由導航
import * as Google from 'expo-auth-session/providers/google'; // Google 登入
import * as AuthSession from 'expo-auth-session';            // Auth Session 支援
import * as Linking from 'expo-linking';                     // Deep Link 支援

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

  // ✅ 用 ref 做「一次性」與「計時器」控管（不受重渲染影響）
  const processingRef = useRef(false);           // 防止重複登入處理
  const navigatedRef = useRef(false);            // 防止重複導航
  const timeoutRef = useRef<NodeJS.Timeout | null>(null); // 登入超時計時器
  const linkingSubRef = useRef<ReturnType<typeof Linking.addEventListener> | null>(null); // Deep link 監聽器

  // ✅ 移除 processGoogleToken，避免多重觸發，統一由 deep link 處理

  // ✅ 移除所有多餘的回調處理函數，避免多重觸發
  // 統一由 handleDeepLinkLogin 和 handleLoginSuccessAndNavigate 處理所有登入流程



  // === Google OAuth 設定 ===
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '794306785311-lrr23m7g6fv43vibr8nebteqdas9ipj2.apps.googleusercontent.com',  // Google 客戶端 ID
    // 使用自有域名重導向
    redirectUri: 'https://avfcare.com/api/oauth/redirect',
    scopes: ['openid', 'profile', 'email'],                       // 要求的權限範圍
    responseType: 'code',                                          // 改用授權碼模式，更可靠
    extraParams: {
      access_type: 'offline',
      prompt: 'consent',
    }
  });
  
  // === Deep Link 登入處理（用 ref 去重；成功後移除監聽）===
  const handleDeepLinkLogin = useCallback(async (url: string) => {
    try {
      console.log('[Deep Link] 處理登入 deep link:', url);
      
      // ✅ 強化去重機制，防止重複處理
      if (processingRef.current) {
        console.log('[Deep Link] 正在處理中，跳過重複請求');
        return true;
      }
      
      if (navigatedRef.current) {
        console.log('[Deep Link] 已導航，跳過重複請求');
        return true;
      }
      
      // 解析 URL 參數 - 支援多種格式
      let params: URLSearchParams;
      
      try {
        const urlObj = new URL(url);
        params = new URLSearchParams(urlObj.search);
      } catch (error) {
        // 如果 URL 解析失敗，嘗試手動解析
        console.log('[Deep Link] URL 解析失敗，嘗試手動解析...');
        const queryString = url.includes('?') ? url.split('?')[1] : url;
        params = new URLSearchParams(queryString);
      }
      
      const googleAuth = params.get('google_auth');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const userId = params.get('user_id');
      const userRole = params.get('user_role');
      const userEmail = params.get('user_email');
      const userPhone = params.get('user_phone');
      const userIdNumber = params.get('user_id_number');
      const userBirthdate = params.get('user_birthdate');
      
      console.log('[Deep Link] 解析的參數:', {
        googleAuth,
        accessToken: accessToken ? '存在' : '不存在',
        refreshToken: refreshToken ? '存在' : '不存在',
        userId,
        userRole,
        userEmail,
        userPhone,
        userIdNumber,
        userBirthdate
      });
      
      if (googleAuth === 'success' && accessToken && userRole) {
        console.log('[Deep Link] 發現有效的登入資料，準備直接導航...');
        
        // ✅ 立即設置處理標記，防止重複處理
        processingRef.current = true;
        
        // 構建登入資料對象
        const loginData = {
          success: true,
          token: accessToken,
          refresh_token: refreshToken,
          user: {
            id: userId,
            role: userRole,
            email: userEmail,
            phone: userPhone,
            id_number: userIdNumber,
            birthdate: userBirthdate,
            name: userEmail // 暫時使用 email 作為 name
          }
        };
        
        console.log('[Deep Link] 直接處理登入成功...');
        clearLoginTimeout(); // 清除超時
        await handleLoginSuccessAndNavigate(loginData);
        
        // ✅ 成功後就把 deep link 監聽拔掉，避免下一次又重觸發
        if (linkingSubRef.current) {
          linkingSubRef.current.remove();
          linkingSubRef.current = null;
          console.log('[Deep Link] 移除監聽器，避免重複觸發');
        }
        
        return true; // 表示成功處理
      }
      
      return false; // 表示沒有處理
    } catch (error) {
      console.error('[Deep Link] 處理 deep link 失敗:', error);
      return false;
    }
  }, []); // ✅ 用 ref，不必把 processing/navigated 放進依賴

  // === 檢查登入狀態（備用方案）===
  const checkLoginStatus = async () => {
    try {
      console.log('[Check Login] 檢查當前登入狀態...');
      const token = await AsyncStorage.getItem('access_token');
      const userRole = await AsyncStorage.getItem('user_role');
      
      console.log('[Check Login] Token:', token ? '存在' : '不存在');
      console.log('[Check Login] User Role:', userRole);
      
      if (token) {
        console.log('[Check Login] 發現已登入，導向相應頁面...');
        setLoading(false);
        
        // 直接導向，避免空頁面問題
        console.log('[Check Login] 直接導向用戶頁面...');
        if (userRole === 'admin') {
          console.log('[Check Login] 跳轉到 /admin/bot');
          router.replace('/admin/bot');
        } else if (userRole === 'doctor') {
          console.log('[Check Login] 跳轉到 /doctor/doctor');
          router.replace('/doctor/doctor');
        } else {
          console.log('[Check Login] 跳轉到 /user/patient');
          router.replace('/user/patient');
        }
      } else {
        console.log('[Check Login] 沒有發現登入狀態，繼續等待...');
        setLoading(false);
      }
    } catch (error) {
      console.error('[Check Login] 檢查登入狀態失敗:', error);
      setLoading(false);
    }
  };

  // === 應用啟動時初始化：只掛一次 deep link 監聽 ===
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('[Initial Setup] 應用啟動，初始化...');
        
        // 重置所有狀態，防止狀態殘留
        processingRef.current = false;
        navigatedRef.current = false;
        setLoading(false);
        setAccount('');
        setPassword('');
        console.log('[Initial Setup] 登入頁面狀態已重置');
        
        // 檢查是否有來自 deep link 的初始 URL
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          console.log('[Initial Setup] 發現初始 deep link:', initialUrl);
          const handled = await handleDeepLinkLogin(initialUrl);
          if (handled) {
            console.log('[Initial Setup] 初始 deep link 處理成功');
            // 不要 return，繼續設置監聽器
          }
        }
        
        // ✅ 存到 ref，方便成功後立即移除
        linkingSubRef.current = Linking.addEventListener('url', (event) => {
          console.log('[Deep Link] 收到 deep link:', event.url);
          handleDeepLinkLogin(event.url);
        });
        
        // 不檢查 AsyncStorage，直接顯示登入頁面
        setLoading(false);
        console.log('[Initial Setup] 初始化完成，顯示登入頁面');
      } catch (error) {
        console.error('[Initial Setup] 初始化失敗:', error);
        setLoading(false);
      }
    };

    initializeApp();
    
    // 清理函數
    return () => {
      if (linkingSubRef.current) {
        linkingSubRef.current.remove();
        linkingSubRef.current = null;
      }
      clearLoginTimeout();
    };
  }, [handleDeepLinkLogin]); // 保留依賴，確保函數更新

  // === 直接處理登入成功並導航（只允許一次執行）===
  const handleLoginSuccessAndNavigate = useCallback(async (loginData: any) => {
    // ✅ 強化防重複處理機制
    if (navigatedRef.current) {
      console.log('[Login Success] 已導航，忽略重複請求');
      return false;
    }
    
    // 如果正在處理中，等待完成
    if (processingRef.current) {
      console.log('[Login Success] 正在處理中，等待完成...');
      // 等待最多 3 秒
      let attempts = 0;
      while (processingRef.current && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (navigatedRef.current) {
        console.log('[Login Success] 等待後發現已導航，忽略重複請求');
        return false;
      }
    }
    
    try {
      // 立即清除登入超時，避免誤報超時
      clearLoginTimeout();
      processingRef.current = true;
      console.log('[Login Success] 處理登入成功，資料:', loginData);
      
      if (!loginData?.success || !loginData?.user) {
        throw new Error('登入資料無效');
      }
      
      const userRole = loginData.user.role;
      console.log('[Login Success] 用戶角色:', userRole);
      
      // ✅ 使用 multiSet 一次性儲存所有資料，提升效能
      await AsyncStorage.multiSet([
        ['access_token', String(loginData.token || '')],
        ['refresh_token', String(loginData.refresh_token || '')],
        ['user_id', String(loginData.user.id || '')],
        ['user_phone', String(loginData.user.phone || '')],
        ['user_email', String(loginData.user.email || '')],
        ['user_id_number', String(loginData.user.id_number || '')],
        ['user_birthdate', String(loginData.user.birthdate || '')],
        ['user_role', String(userRole || 'patient')],
        ['user_full_name', String(loginData.user.name || loginData.user.email || '')],
      ]);
      
      console.log('[Login Success] 登入資訊已儲存到 AsyncStorage');
      setLoading(false);
      
      // ✅ 在 replace 前就鎖住，防止重複導航
      navigatedRef.current = true;
      
      // 直接導航，不顯示確認對話框，避免空頁面問題
      console.log('[Login Success] 直接導航到用戶頁面...');
      
      // ✅ 使用 setTimeout 確保狀態更新完成後再導航
      setTimeout(() => {
        if (userRole === 'admin') {
          console.log('[Login Success] 跳轉到 /admin/bot');
          router.replace('/admin/bot');
        } else if (userRole === 'doctor') {
          console.log('[Login Success] 跳轉到 /doctor/doctor');
          router.replace('/doctor/doctor');
        } else {
          console.log('[Login Success] 跳轉到 /user/patient');
          router.replace('/user/patient');
        }
      }, 100); // 100ms 延遲確保狀態更新
      
      return true;
    } catch (error) {
      console.error('[Login Success] 處理失敗:', error);
      processingRef.current = false;
      navigatedRef.current = false; // 重置導航狀態，允許重試
      return false;
    }
  }, [router]);
  
  // === 登入超時管理（用 ref 管理，避免被重渲染重置）===
  const setLoginTimeout = () => {
    // 清除之前的超時
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // 設置 45 秒超時，並檢查登入狀態
    timeoutRef.current = setTimeout(async () => {
      // 檢查是否正在處理登入或是否已經有 token
      const token = await AsyncStorage.getItem('access_token');
      if (processingRef.current || token) {
          console.log('[Login Timeout] 登入已處理或已成功，取消超時警告');
          return;
        }
        
        console.log('[Login Timeout] 登入超時，回到登入頁面');
        setLoading(false);
        Alert.alert('Google 登入超時', '請使用帳號密碼登入或重新嘗試 Google 登入');
    }, 45000); // 45 秒後顯示超時訊息
    
    console.log('[Login Timeout] 設置 45 秒登入超時');
  };
  
  const clearLoginTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      console.log('[Login Timeout] 清除登入超時');
    }
  };


  // === 觸發 Google 登入（加強調試和結果處理）===
  const customPromptAsync = async () => {
    if (!request) return;
    
    setLoading(true);
    setLoginTimeout();
    
    // ✅ 如果有 code_verifier，將其編碼到 state 中傳遞給後端
    let customState = request.state || '';
    if (request.codeVerifier) {
      const stateData = {
        original_state: customState,
        code_verifier: request.codeVerifier
      };
      customState = btoa(JSON.stringify(stateData));
      console.log('[Google OAuth] Code verifier 已編碼到 state 參數');
    }
    
    // 構建 OAuth URL
    const params = new URLSearchParams({
      client_id: request.clientId,
      redirect_uri: request.redirectUri,
      response_type: request.responseType,
      scope: request.scopes?.join(' ') || '',
      state: customState,
      code_challenge: request.codeChallenge || '',
      code_challenge_method: request.codeChallengeMethod || 'S256',
      access_type: 'offline',
      prompt: 'consent',
    });
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    console.log('[Google OAuth] 開啟 WebBrowser，URL:', authUrl);
    console.log('[Google OAuth] Redirect URI:', request.redirectUri);
    
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, request.redirectUri);
      
      console.log('=== WebBrowser 結果詳細調試 ===');
      console.log('[Google OAuth] 結果類型:', result.type);
      console.log('[Google OAuth] 完整結果物件:', result);
      console.log('[Google OAuth] 結果 URL:', (result as any).url);
      console.log('[Google OAuth] 當前狀態:', {
        processing: processingRef.current,
        navigated: navigatedRef.current,
        loading: loading
      });
      console.log('=== WebBrowser 調試結束 ===');
      
      if (result.type === 'success') {
        console.log('[Google OAuth] WebBrowser 成功返回，分析結果...');
        
        // 檢查是否有直接的 deep link 結果
        const resultUrl = (result as any).url;
        console.log('[Google OAuth] 檢查結果 URL:', resultUrl);
        
        if (resultUrl && resultUrl.includes('avfcare://auth')) {
          console.log('[Google OAuth] 檢測到 deep link，直接處理...', resultUrl);
          const handled = await handleDeepLinkLogin(resultUrl);
          if (handled) {
            console.log('[Google OAuth] Deep link 處理成功');
            return;
          }
        } else if (resultUrl) {
          console.log('[Google OAuth] 結果 URL 不包含 deep link，URL:', resultUrl);
        } else {
          console.log('[Google OAuth] 沒有結果 URL');
        }
        
        // 否則等待 postMessage 或其他回調
        console.log('[Google OAuth] 等待 postMessage 或其他回調機制...');
        console.log('[Google OAuth] 設置 60 秒等待超時...');
        
        // 設置額外的等待機制，給 postMessage 時間
        setTimeout(() => {
          if (!processingRef.current && !navigatedRef.current) {
            console.log('[Google OAuth] 60 秒後仍未收到回調，可能出現問題');
            console.log('[Google OAuth] 當前狀態檢查:', {
              processing: processingRef.current,
              navigated: navigatedRef.current,
              loading: loading
            });
          }
        }, 60000);
        
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        console.log('[Google OAuth] 用戶取消登入');
        clearLoginTimeout();
        setLoading(false);
        processingRef.current = false;
        navigatedRef.current = false;
      } else {
        console.log('[Google OAuth] 其他結果類型:', result.type);
        console.log('[Google OAuth] 等待回調或顯示超時...');
      }
    } catch (error: any) {
      console.error('[Google OAuth] WebBrowser 錯誤:', error);
      clearLoginTimeout();
      setLoading(false);
      processingRef.current = false;
      navigatedRef.current = false;
      Alert.alert('Google 登入錯誤', '請重新嘗試或使用帳號密碼登入');
    }
  };





  // === 監聽來自 OAuth 重導向頁面的 postMessage（加強去重保護）===
  useEffect(() => {
    console.log('[postMessage] 設置訊息監聽器...');
    
    // 在 React Native WebBrowser 環境中，可能需要依靠 postMessage
    if (typeof window !== 'undefined' && window.addEventListener) {
      const handleMessage = (event: MessageEvent) => {
        console.log('=== PostMessage 詳細調試 ===');
        console.log('[postMessage] 收到訊息類型:', event.data?.type);
        console.log('[postMessage] 訊息來源:', event.origin);
        console.log('[postMessage] 完整訊息:', event.data);
        console.log('[postMessage] 當前處理狀態:', {
          processing: processingRef.current,
          navigated: navigatedRef.current,
          loading: loading
        });
        console.log('=== PostMessage 調試結束 ===');
        
        // ✅ 強化去重檢查，避免與 deep link 衝突
        if (navigatedRef.current) {
          console.log('[postMessage] 已導航，忽略 postMessage');
          return;
        }
        
        if (processingRef.current) {
          console.log('[postMessage] 正在處理中，忽略 postMessage');
          return;
        }
        
        // 放寬來源檢查，因為重導向頁面可能來自不同子域名
        if (!event.origin.includes('avfcare.com')) {
          console.log('[postMessage] 忽略來自其他域名的訊息:', event.origin);
          return;
        }
        
        if (event.data.type === 'GOOGLE_OAUTH_SUCCESS') {
          if (event.data.loginData) {
            console.log('[postMessage] 處理 Google OAuth 登入資料:', event.data.loginData);
            // ✅ 設置處理標記，防止重複處理
            processingRef.current = true;
            // ✅ 直接呼叫統一的成功處理函數
            clearLoginTimeout();
            handleLoginSuccessAndNavigate(event.data.loginData);
          } else {
            console.log('[postMessage] OAuth 成功但缺少必要資料:', event.data);
          }
        } else if (event.data.type === 'GOOGLE_OAUTH_ERROR') {
          console.log('[postMessage] 收到 OAuth 錯誤訊息:', event.data.error);
          clearLoginTimeout();
          setLoading(false);
          processingRef.current = false;
          navigatedRef.current = false;
          Alert.alert('Google 登入錯誤', event.data.error || '登入失敗');
        } else if (event.data.type === 'GOOGLE_OAUTH_CANCELLED') {
          console.log('[postMessage] 用戶取消 Google 登入');
          clearLoginTimeout();
          setLoading(false);
          processingRef.current = false;
          navigatedRef.current = false;
          // 用戶取消登入，保持在登入頁面，不顯示錯誤訊息
        } else {
          console.log('[postMessage] 未處理的訊息類型:', event.data.type);
        }
      };

      window.addEventListener('message', handleMessage);
      
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    } else {
      console.log('[postMessage] 在 React Native 環境中，同時監聽 postMessage 和 deep link');
    }
  }, []);

  // ✅ 移除 Google OAuth 回應處理，避免與 deep link 衝突
  // 所有 OAuth 結果統一由 customPromptAsync 和 deep link 處理

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
          await AsyncStorage.setItem('access_token', String(data.token || ''));           // JWT 存取令牌
          if (data.refresh_token) {
            await AsyncStorage.setItem('refresh_token', String(data.refresh_token)); // JWT 刷新令牌
          }
          
          // 除錯輸出
          console.log('[Login] Token 儲存成功');
          console.log('[Login] Access Token Length:', data.token ? data.token.length : 0);
          console.log('[Login] Access Token:', data.token);
          console.log('[Login] User ID:', data.user.id);
          
          // === 儲存用戶資訊 ===
          await AsyncStorage.setItem('user_id', String(data.user.id || ''));
          await AsyncStorage.setItem('user_phone', String(data.user.phone || ''));
          await AsyncStorage.setItem('user_email', String(data.user.email || ''));
          await AsyncStorage.setItem('user_id_number', String(data.user.id_number || ''));
          await AsyncStorage.setItem('user_birthdate', String(data.user.birthdate || ''));
          await AsyncStorage.setItem('user_mrn', String(data.user.mrn || ''));      // 病歷號
          
          // 直接導向，避免空頁面問題
          console.log('[Navigation] 用戶角色:', data.user.role);
          if (data.user.role === 'admin') {
            console.log('[Navigation] 跳轉到 /admin/bot');
            router.replace('/admin/bot');        // 管理員 → 管理介面
          } else if (data.user.role === 'doctor') {
            console.log('[Navigation] 跳轉到 /doctor/doctor');
            router.replace('/doctor/doctor');    // 醫師 → 醫師介面
          } else {
            console.log('[Navigation] 跳轉到 /user/patient');
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
    console.log('[Google OAuth] 開始 Google 登入流程...');
    console.log('[Google OAuth] 重導向 URI: https://avfcare.com/api/oauth/redirect');
    console.log('[Google OAuth] Code verifier 可用:', request?.codeVerifier ? '是' : '否');
    
    // 使用自定義的 promptAsync，包含 code_verifier
    customPromptAsync();  // 開啟 Google 登入視窗
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
