import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, Platform, Image, SafeAreaView, KeyboardAvoidingView } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { API_URL } from '../../utils/appgol_config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Google from 'expo-auth-session/providers/google';
import { ResponseType } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { authFetch } from '../../utils/authFetch';
WebBrowser.maybeCompleteAuthSession();

export default function Profile() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVerify, setShowVerify] = useState<'email'|'phone'|null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editProfile, setEditProfile] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  // 1. 新增 state 控制 email/phone 變更
  const [changeField, setChangeField] = useState<'email'|'phone'|null>(null);
  const [newFieldValue, setNewFieldValue] = useState('');
  const [changeLoading, setChangeLoading] = useState(false);
  
  // 新增驗證錯誤狀態
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  
  // 新增 Google 綁定狀態
  const [isGoogleBinding, setIsGoogleBinding] = useState(false);

  // ============================================================================
  // 欄位驗證函數
  // ============================================================================
  const validateField = (fieldName: string, value: string): string => {
    switch (fieldName) {
      case 'id_number':
        // 台灣身分證字號驗證：1碼英文 + 9碼數字
        const idRegex = /^[A-Z][0-9]{9}$/;
        if (!value) return '請輸入身分證字號';
        if (!idRegex.test(value.toUpperCase())) return '身分證字號格式錯誤（需1碼英文+9碼數字）';
        return '';

      case 'phone':
        // 台灣手機號碼驗證：09開頭 + 8碼數字
        const phoneRegex = /^09[0-9]{8}$/;
        if (!value) return '請輸入手機號碼';
        if (!phoneRegex.test(value)) return '手機號碼格式錯誤（需09開頭+8碼數字）';
        return '';

      case 'emergency_phone':
        // 緊急聯絡電話：可以是市話或手機
        const emergencyPhoneRegex = /^(0[2-9][0-9]{7,8}|09[0-9]{8})$/;
        if (!value) return '請輸入緊急聯絡電話';
        if (!emergencyPhoneRegex.test(value)) return '電話格式錯誤';
        return '';

      case 'email':
        // Email 格式驗證
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!value) return '請輸入 Email';
        if (!emailRegex.test(value)) return 'Email 格式錯誤';
        return '';

      case 'full_name':
        // 姓名驗證：至少2個字，最多10個字
        if (!value) return '請輸入姓名';
        if (value.length < 2) return '姓名至少需要2個字';
        if (value.length > 10) return '姓名不可超過10個字';
        return '';

      case 'mrn':
        // 病例號驗證：至少3個字符，最多20個字符
        if (!value) return '請輸入病例號';
        if (value.length < 3) return '病例號至少需要3個字符';
        if (value.length > 20) return '病例號不可超過20個字符';
        return '';

      case 'address':
        // 地址驗證：至少5個字，最多100個字
        if (!value) return '請輸入地址';
        if (value.length < 5) return '地址至少需要5個字';
        if (value.length > 100) return '地址不可超過100個字';
        return '';

      case 'emergency_name':
        // 緊急聯絡人姓名：至少2個字，最多10個字
        if (!value) return '請輸入緊急聯絡人姓名';
        if (value.length < 2) return '姓名至少需要2個字';
        if (value.length > 10) return '姓名不可超過10個字';
        return '';

      case 'birthdate':
        // 生日驗證：檢查日期格式和合理性
        if (!value) return '請選擇生日';
        const birthDate = new Date(value);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        if (isNaN(birthDate.getTime())) return '生日格式錯誤';
        if (age < 0 || age > 150) return '請輸入合理的生日';
        return '';

      default:
        return '';
    }
  };

  // 即時驗證處理函數
  const handleFieldChange = (fieldName: string, value: string) => {
    // 更新欄位值
    setEditProfile({ ...editProfile, [fieldName]: value });
    
    // 即時驗證
    const error = validateField(fieldName, value);
    setValidationErrors(prev => ({
      ...prev,
      [fieldName]: error
    }));
  };

  // 驗證所有必填欄位
  const validateAllFields = (): boolean => {
    // 只驗證可以編輯的欄位，phone 和 email 透過變更功能處理
    const fieldsToValidate = [
      'full_name', 'id_number', 'mrn', 'birthdate', 
      'address', 'emergency_name', 'emergency_phone'
    ];
    
    const errors: {[key: string]: string} = {};
    let hasErrors = false;

    fieldsToValidate.forEach(field => {
      const value = editProfile[field] || '';
      const error = validateField(field, value);
      if (error) {
        errors[field] = error;
        hasErrors = true;
      }
    });

    setValidationErrors(errors);
    return !hasErrors;
  };

  // 2. Google 連結流程 - 使用 PKCE 流程
  const [googleRequest, , ] = Google.useAuthRequest({
    clientId: '794306785311-lrr23m7g6fv43vibr8nebteqdas9ipj2.apps.googleusercontent.com',
    redirectUri: 'https://avfcare.com/api/oauth/redirect',
    responseType: ResponseType.Code,
    scopes: ['openid', 'profile', 'email'],
    extraParams: {},
    shouldAutoExchangeCode: false,
    // PKCE 是預設啟用的，不需要額外配置
  });

  // 載入個人資料
  const loadProfile = async () => {
    try {
      const userId = await AsyncStorage.getItem('user_id');
      const phone = await AsyncStorage.getItem('user_phone');
      const email = await AsyncStorage.getItem('user_email');
      
      console.log('[Profile] 從 AsyncStorage 讀取用戶資訊:', { userId, phone, email });
      
      let url = '';
      if (userId) {
        url = `${API_URL}/api/user/profile?id=${userId}`;
      } else if (phone) {
        url = `${API_URL}/api/user/profile?phone=${phone}`;
      } else if (email) {
        url = `${API_URL}/api/user/profile?email=${email}`;
      }

      if (url) {
        const response = await authFetch(url);
        const data = await response.json();
        
        if (data.user) {
          setProfile(data.user);
          console.log('[Profile] 個人資料載入成功:', data.user);
        } else {
          setError('無法載入個人資料');
        }
      } else {
        setError('無法識別用戶身份');
      }
    } catch (error) {
      console.error('[Profile] 載入個人資料失敗:', error);
      setError('載入個人資料失敗');
    } finally {
      setLoading(false);
    }
  };

  // Google 綁定流程處理
  const handleGoogleLinking = async () => {
    if (!googleRequest) {
      Alert.alert('錯誤', 'Google 連結初始化失敗，請稍後再試');
      return;
    }
    
    // 檢查 googleRequest 是否準備好
    if (!googleRequest.url) {
      Alert.alert('錯誤', 'Google 連結尚未準備好，請稍後再試');
      return;
    }
    
    setIsGoogleBinding(true);
    setLoading(true);
    
    try {
      console.log('[Google Binding] 開始 Google 帳號綁定流程...');
      
      // 構建包含 code_verifier 的 state 參數
      let customState = googleRequest.state || '';
      const userId = profile?.id || await AsyncStorage.getItem('user_id');
      
      console.log('[Google Binding] Google Request 詳情:', {
        hasCodeVerifier: !!googleRequest.codeVerifier,
        codeVerifier: googleRequest.codeVerifier?.substring(0, 10) + '...',
        hasCodeChallenge: !!googleRequest.codeChallenge,
        codeChallenge: googleRequest.codeChallenge?.substring(0, 10) + '...',
        state: googleRequest.state,
        url: googleRequest.url?.substring(0, 50) + '...'
      });
      
      if (googleRequest.codeVerifier) {
        // 簡單的 state 格式：userId_codeVerifier
        customState = `${userId}_${googleRequest.codeVerifier}`;
        console.log('[Google Binding] Code verifier 已編碼到 state 參數:', customState);
      } else {
        console.warn('[Google Binding] 警告：沒有 code_verifier，PKCE 流程可能失敗');
        Alert.alert('錯誤', 'PKCE 流程初始化失敗，請重新嘗試');
        return;
      }
      
      // 構建自定義的 OAuth URL
      const params = new URLSearchParams({
        client_id: googleRequest.clientId,
        redirect_uri: googleRequest.redirectUri,
        response_type: googleRequest.responseType,
        scope: googleRequest.scopes?.join(' ') || '',
        state: customState,
        code_challenge: googleRequest.codeChallenge || '',
        code_challenge_method: googleRequest.codeChallengeMethod || 'S256',
        access_type: 'offline',
        prompt: 'consent'
      });
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      console.log('[Google Binding] 開啟 OAuth 流程...');
      
      // 使用 WebBrowser 開啟 OAuth 流程
      const result = await WebBrowser.openAuthSessionAsync(authUrl, googleRequest.redirectUri);
      
      console.log('[Google Binding] WebBrowser 結果:', result);
      console.log('[Google Binding] WebBrowser 結果類型:', result.type);
      console.log('[Google Binding] WebBrowser 結果 URL:', (result as any).url);
      
      if (result.type === 'success') {
        console.log('[Google Binding] OAuth 流程完成，開始綁定...');
        
        // 從 URL 中提取授權碼
        const url = (result as any).url;
        const urlParams = new URLSearchParams(url.split('?')[1]);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        
        console.log('[Google Binding] 提取的參數:', {
          code: code ? code.substring(0, 10) + '...' : 'null',
          state: state ? state.substring(0, 20) + '...' : 'null',
          url: url.substring(0, 100) + '...'
        });
        
        if (!code) {
          throw new Error('未獲取到授權碼');
        }
        
        // 使用授權碼換取 access token
        // 使用原始的 customState（包含 userId_codeVerifier）而不是從 URL 提取的 state
        const requestPayload = {
          code: code,
          state: customState, // 使用我們構建的 customState
          code_verifier: googleRequest.codeVerifier || ''
        };
        
        console.log('[Google Binding] 發送 POST 請求，payload:', {
          code: requestPayload.code ? requestPayload.code.substring(0, 10) + '...' : 'null',
          state: requestPayload.state ? requestPayload.state.substring(0, 20) + '...' : 'null',
          code_verifier: requestPayload.code_verifier ? requestPayload.code_verifier.substring(0, 10) + '...' : 'null',
          originalState: state ? state.substring(0, 20) + '...' : 'null',
          customState: customState ? customState.substring(0, 20) + '...' : 'null'
        });
        
        const tokenResponse = await fetch(`${API_URL}/api/auth/google-callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestPayload)
        });
        const tokenData = await tokenResponse.json();
        console.log('[Google Binding] 後端回應:', tokenData);
        
        if (tokenData.success) {
          console.log('[Google Binding] 綁定成功');
          // 清除本地儲存的所有資料
          await AsyncStorage.removeItem('access_token');
          await AsyncStorage.removeItem('refresh_token');
          await AsyncStorage.removeItem('user_id');
          await AsyncStorage.removeItem('user_phone');
          await AsyncStorage.removeItem('user_email');
          // 重置 Google 綁定狀態
          setIsGoogleBinding(false);
          // 直接導向登入頁面
          router.replace('/');
        } else {
          console.error('[Google Binding] 綁定失敗:', tokenData);
          Alert.alert('綁定失敗', tokenData.message || 'Google 帳號綁定失敗');
          setIsGoogleBinding(false);
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        console.log('[Google Binding] 用戶取消綁定');
        Alert.alert('已取消', 'Google 帳號綁定已取消');
        setIsGoogleBinding(false);
      } else {
        console.log('[Google Binding] 綁定失敗:', result);
        Alert.alert('綁定失敗', '無法完成 Google 帳號綁定');
        setIsGoogleBinding(false);
      }
    } catch (error) {
      console.error('[Google Binding] 錯誤:', error);
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      Alert.alert('錯誤', `Google 帳號綁定失敗: ${errorMessage}`);
      setIsGoogleBinding(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 只有在不是 Google 綁定過程中時才載入個人資料
    if (!isGoogleBinding) {
      loadProfile();
    }
  }, [isGoogleBinding]);

   
  // 發送驗證碼 - 用於驗證現有的 email/phone
  const handleSendVerifyCode = async (type: 'email'|'phone') => {
    try {
      const userId = profile.id || await AsyncStorage.getItem('user_id');
      const payload = {
        user_id: parseInt(userId),
        ...(type === 'email' ? { email: profile.email } : { phone: profile.phone })
      };
      
      const response = await fetch(`${API_URL}/api/auth/verify-and-update-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (data.success) {
        Alert.alert('驗證碼已發送', `驗證碼已發送到您的${type === 'email' ? 'Email' : '電話'}`);
        setShowVerify(type);
      } else {
        Alert.alert('錯誤', data.message || '發送失敗');
      }
    } catch (error) {
      Alert.alert('錯誤', '發送失敗');
    }
  };

  const handleVerify = async (type: 'email'|'phone') => {
    try {
      const userId = profile.id || await AsyncStorage.getItem('user_id');
      
      const payload = {
        user_id: parseInt(userId),
        ...(type === 'email' ? { email: profile.email } : { phone: profile.phone }),
        code: verifyCode
      };
      
      console.log(`[Verify] 驗證 ${type}，payload:`, payload);
      
      const res = await fetch(`${API_URL}/api/auth/verify-and-update-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success) {
        Alert.alert('驗證成功');
        
        // 使用後端回傳的最新用戶資料
        if (data.user) {
          console.log(`[Verify] 更新用戶資料:`, data.user);
          setProfile(data.user);
          
          // 同步更新 AsyncStorage
          await AsyncStorage.setItem('user_id', String(data.user.id));
          if (data.user.phone) {
            await AsyncStorage.setItem('user_phone', data.user.phone);
            await AsyncStorage.setItem('user_phone_verified', data.user.phone_verified ? 'true' : 'false');
          }
          if (data.user.email) {
            await AsyncStorage.setItem('user_email', data.user.email);
            await AsyncStorage.setItem('user_email_verified', data.user.email_verified ? 'true' : 'false');
          }
        }
      } else {
        Alert.alert('驗證失敗', data.message || '');
      }
      setShowVerify(null);
      setVerifyCode('');
    } catch (error) {
      console.error('[Verify] 錯誤:', error);
      Alert.alert('驗證失敗');
    }
  };

  const handleEdit = () => {
    setEditProfile(profile);
    setEditMode(true);
    // 清除之前的驗證錯誤
    setValidationErrors({});
  };
  const handleSave = async () => {
    // 先進行欄位驗證
    if (!validateAllFields()) {
      Alert.alert('驗證失敗', '請檢查並修正紅色標示的欄位錯誤');
      return;
    }

    // 檢查必要的 phone 欄位（從 profile 取得，不是 editProfile）
    if (!profile.phone) {
      Alert.alert('請先設置電話號碼', '請使用「變更」功能設置電話號碼');
      return;
    }

    const payload = {
      ...(profile.id ? { id: profile.id } : {}),
      ...(profile.phone ? { phone: profile.phone } : {}),
      ...(profile.email ? { email: profile.email } : {}),
      id_number: editProfile.id_number,
      mrn: editProfile.mrn,
      full_name: editProfile.full_name,
      birthdate: editProfile.birthdate,
      address: editProfile.address,
      emergency_name: editProfile.emergency_name,
      emergency_phone: editProfile.emergency_phone,
      email_verified: profile.email_verified,
      phone_verified: profile.phone_verified
    };
    console.log('儲存個資 payload:', payload);
    setSaving(true);
    try {
      const res = await authFetch(`${API_URL}/api/user/profile/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setProfile({ ...profile, ...editProfile });
        await AsyncStorage.setItem('user_id_number', editProfile.id_number || '');
        await AsyncStorage.setItem('user_birthdate', editProfile.birthdate || '');
        await AsyncStorage.setItem('user_mrn', editProfile.mrn || '');
        Alert.alert('儲存成功');
        setEditMode(false);
      } else {
        Alert.alert('儲存失敗1', data.message || '');
      }
    } catch {
      Alert.alert('儲存失敗2');
    } finally {
      setSaving(false);
    }
  };

  // 變更 email/phone 流程 - 立即驗證並更新
  const handleChangeField = async () => {
    if (!newFieldValue) return Alert.alert('請輸入新' + (changeField === 'email' ? 'Email' : '電話'));
    
    // 驗證新輸入的值
    const validationError = validateField(changeField!, newFieldValue);
    if (validationError) {
      Alert.alert('格式錯誤', validationError);
      return;
    }
    
    setChangeLoading(true);
    try {
      const userId = profile.id || await AsyncStorage.getItem('user_id');
      
      // 發送驗證碼到新的聯絡方式
      const payload = {
        user_id: parseInt(userId),
        [changeField as string]: newFieldValue
      };
      
      const response = await fetch(`${API_URL}/api/auth/verify-and-update-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (data.success) {
        // 暫時更新本地狀態，但標記為未驗證
        setProfile({ 
          ...profile, 
          [changeField as string]: newFieldValue, 
          [`${changeField as string}_verified`]: false 
        });
        
        setChangeField(null);
        setNewFieldValue('');
        
        Alert.alert(
          '驗證碼已發送', 
          `驗證碼已發送到您的新${changeField === 'email' ? 'Email' : '電話'}，請點擊旁邊的「驗證」按鈕完成驗證`,
          [{ 
            text: '確定',
            onPress: () => {
              // 自動開啟驗證對話框
              setShowVerify(changeField);
            }
          }]
        );
      } else {
        Alert.alert('錯誤', data.message || '發送失敗');
      }
    } catch (error) {
      Alert.alert('錯誤', '變更失敗');
    } finally {
      setChangeLoading(false);
    }
  };

 

  if (loading) return <Text style={{ padding: 20 }}>載入中...</Text>;
  if (error) return <Text style={{ padding: 20, color: 'red' }}>{error}</Text>;

  const isGoogleLinked = !!profile?.google_id;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >

      <Text style={styles.name}>
        {profile?.full_name || profile?.email || profile?.phone || '(未命名)'}
      </Text>
      <Text style={styles.subtitle}>
        {profile?.email || profile?.phone || ''}
      </Text>

      <View style={styles.infoList}>
        <InfoField 
          label="姓名" 
          icon="user" 
          value={editMode ? (editProfile.full_name ?? '') : (profile?.full_name ?? '')} 
          editable={editMode} 
          onChange={v => handleFieldChange('full_name', v)}
          fieldName="full_name"
          validationError={editMode ? validationErrors.full_name : undefined}
        />
        
        <InfoField 
          label="身分證字號" 
          icon="id-card" 
          value={editMode ? (editProfile.id_number ?? '') : (profile?.id_number ?? '')} 
          editable={editMode} 
          onChange={v => handleFieldChange('id_number', v.toUpperCase())}
          fieldName="id_number"
          validationError={editMode ? validationErrors.id_number : undefined}
        />
        
        <InfoField 
          label="病例號(MRN)" 
          icon="hospital-o" 
          value={editMode ? (editProfile.mrn ?? '') : (profile?.mrn ?? '')} 
          editable={editMode} 
          onChange={v => handleFieldChange('mrn', v)}
          fieldName="mrn"
          validationError={editMode ? validationErrors.mrn : undefined}
        />
        
        <InfoField 
          label="Email" 
          icon="envelope" 
          value={profile?.email ?? ''} 
          editable={false} 
          extra={
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              {profile?.email && !profile?.email_verified && (
                <TouchableOpacity 
                  onPress={() => handleSendVerifyCode('email')} 
                  style={[styles.verifyBtn, {marginRight: 8}]}
                >
                  <Text style={{color:'#ff6600', fontSize: 12}}>驗證</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setChangeField('email')}>
                <Text style={{color:'#007AFF'}}>變更</Text>
              </TouchableOpacity>
            </View>
          } 
        />
        
        <InfoField 
          label="電話" 
          icon="phone" 
          value={profile?.phone ?? ''} 
          editable={false} 
          extra={
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              {profile?.phone && !profile?.phone_verified && (
                <TouchableOpacity 
                  onPress={() => handleSendVerifyCode('phone')} 
                  style={[styles.verifyBtn, {marginRight: 8}]}
                >
                  <Text style={{color:'#ff6600', fontSize: 12}}>驗證</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setChangeField('phone')}>
                <Text style={{color:'#007AFF'}}>變更</Text>
              </TouchableOpacity>
            </View>
          } 
        />
        
        <InfoField
          label="生日"
          icon="calendar"
          value={editMode ? (editProfile.birthdate ?? '') : (profile?.birthdate ?? '')}
          editable={editMode}
          onPress={editMode ? () => setShowDatePicker(true) : undefined}
          fieldName="birthdate"
          validationError={editMode ? validationErrors.birthdate : undefined}
        />
        {editMode && showDatePicker && (
          <DateTimePicker
            value={editProfile.birthdate ? new Date(editProfile.birthdate) : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => {
              setShowDatePicker(false);
              if (date) {
                const dateString = date.toISOString().slice(0, 10);
                handleFieldChange('birthdate', dateString);
              }
            }}
          />
        )}
        
        <InfoField 
          label="地址" 
          icon="home" 
          value={editMode ? (editProfile.address ?? '') : (profile?.address ?? '')} 
          editable={editMode} 
          onChange={v => handleFieldChange('address', v)}
          fieldName="address"
          validationError={editMode ? validationErrors.address : undefined}
        />
        
        <InfoField 
          label="緊急聯絡人" 
          icon="user" 
          value={editMode ? (editProfile.emergency_name ?? '') : (profile?.emergency_name ?? '')} 
          editable={editMode} 
          onChange={v => handleFieldChange('emergency_name', v)}
          fieldName="emergency_name"
          validationError={editMode ? validationErrors.emergency_name : undefined}
        />
        
        <InfoField 
          label="緊急聯絡電話" 
          icon="phone" 
          value={editMode ? (editProfile.emergency_phone ?? '') : (profile?.emergency_phone ?? '')} 
          editable={editMode} 
          onChange={v => handleFieldChange('emergency_phone', v)}
          fieldName="emergency_phone"
          validationError={editMode ? validationErrors.emergency_phone : undefined}
        />

      </View>
      {/* Google 連結/登入按鈕  */}
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#f5f5f5',
          borderRadius: 8,
          paddingVertical: 12,
          paddingHorizontal: 16,
          marginBottom: 16,
          borderWidth: isGoogleLinked ? 2 : 0,
          borderColor: isGoogleLinked ? '#4285F4' : 'transparent',
          alignSelf: 'center',
          minWidth: 220,
          justifyContent: 'center',
          opacity: isGoogleLinked ? 0.7 : 1
        }}
        onPress={() => {
          if (!isGoogleLinked) handleGoogleLinking();
        }}
        disabled={isGoogleLinked}
      >
        <Image
          source={require('../../assets/images/google.png')}
          style={{ width: 24, height: 24, marginRight: 10 }}
          resizeMode="contain"
        />
        <Text style={{ color: '#222', fontWeight: 'bold', fontSize: 16 }}>
          {isGoogleLinked ? '已連結 Google 帳號' : '使用 Google 連結'}
        </Text>
      </TouchableOpacity>
      {editMode ? (
        <TouchableOpacity style={styles.editBtn} onPress={handleSave} disabled={saving}>
          <Text style={styles.editText}>{saving ? '儲存中...' : '儲存'}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.editBtn} onPress={handleEdit}>
          <Text style={styles.editText}>編輯個資</Text>
        </TouchableOpacity>
      )}
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* 驗證碼輸入彈窗 */}
      <Modal visible={!!showVerify} transparent animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>請輸入{showVerify==='email'?'Email':'電話'}驗證碼</Text>
            <TextInput
              value={verifyCode}
              onChangeText={setVerifyCode}
              style={styles.modalInput}
              keyboardType="number-pad"
              placeholder="請輸入驗證碼"
            />
            <View style={styles.modalButtonRow}>
              <TouchableOpacity 
                onPress={()=>setShowVerify(null)} 
                style={[styles.modalButton, styles.modalCancelButton]}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={()=>handleVerify(showVerify!)} 
                style={[styles.modalButton, styles.modalConfirmButton]}
              >
                <Text style={styles.modalConfirmText}>送出</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
      {/* 變更 Email/電話彈窗 */}
      <Modal visible={!!changeField} transparent animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView 
            style={styles.modalKeyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>變更{changeField==='email'?'Email':'電話'}</Text>
              <TextInput
                value={newFieldValue}
                onChangeText={setNewFieldValue}
                style={styles.modalInput}
                keyboardType={changeField==='email'?'email-address':'phone-pad'}
                autoCapitalize="none"
                placeholder={`請輸入新${changeField==='email'?'Email':'電話'}`}
              />
              <Text style={styles.modalSubtitle}>
                * 變更後將需要重新驗證{changeField==='email'?'Email':'電話'}
              </Text>
              <View style={styles.modalButtonRow}>
                <TouchableOpacity 
                  onPress={()=>{setChangeField(null);setNewFieldValue('');}} 
                  style={[styles.modalButton, styles.modalCancelButton]}
                >
                  <Text style={styles.modalCancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleChangeField} 
                  disabled={changeLoading}
                  style={[styles.modalButton, styles.modalConfirmButton]}
                >
                  <Text style={styles.modalConfirmText}>
                    {changeLoading ? '更新中...' : '確認變更'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

interface InfoFieldProps {
  icon: keyof typeof FontAwesome.glyphMap;
  label: string;
  value: string;
  editable?: boolean;
  onChange?: (v: string) => void;
  onPress?: () => void;
  extra?: React.ReactNode;
  fieldName?: string;
  validationError?: string;
}
const InfoField = ({ icon, label, value, editable, onChange, onPress, extra, fieldName, validationError }: InfoFieldProps) => (
  <View>
    <TouchableOpacity 
      style={[styles.row, validationError ? styles.rowError : null]} 
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <FontAwesome name={icon} size={20} color={validationError ? "#ff4444" : "#333"} style={{ width: 30 }} />
      <Text style={[styles.rowLabel, validationError ? styles.rowLabelError : null]}>{label}：</Text>
      {editable && onPress ? (
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowValue, { color: '#007AFF' }]}>{value || '請選擇'}</Text>
        </View>
      ) : editable ? (
        <TextInput
          style={[styles.rowValueInput, validationError ? styles.rowValueInputError : null]}
          value={value}
          onChangeText={onChange}
          placeholder={`請輸入${label}`}
        />
      ) : (
        <Text style={styles.rowValue}>{value}</Text>
      )}
      {extra}
    </TouchableOpacity>
    {validationError && (
      <Text style={styles.validationErrorText}>{validationError}</Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#F5F5F5' 
  },
  keyboardAvoidingView: { 
    flex: 1 
  },
  container: { 
    flex: 1 
  },
  contentContainer: { 
    padding: 20,
    paddingBottom: 40, // 額外底部間距
    minHeight: '100%' // 確保內容能夠滾動
  },

  name: { 
    fontSize: 28,  
    fontWeight: 'bold', 
    textAlign: 'center',
    marginTop: 20, // 添加頂部間距
    marginBottom: 8
  },
  subtitle: { 
    textAlign: 'center', 
    color: '#666', 
    marginBottom: 20 
  },
  infoList: { 
    marginTop: 10 
  },
  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderColor: '#DDD',
    minHeight: 48 // 確保觸控區域足夠大
  },
  rowLabel: { 
    flexShrink: 0, 
    fontSize: 16, 
    marginRight: 8,
    width: 80 // 固定標籤寬度
  },
  rowValue: { 
    fontSize: 16, 
    color: '#333',
    flex: 1
  },
  rowValueInput: { 
    fontSize: 16, 
    color: '#333', 
    flex: 1, 
    borderBottomWidth: 1, 
    borderColor: '#CCC',
    paddingVertical: 8
  },
  editBtn: { 
    marginTop: 30, 
    marginBottom: 20, // 新增底部間距
    backgroundColor: '#007AFF', 
    padding: 12, 
    borderRadius: 10, 
    alignItems: 'center' 
  },
  editText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  verifyBtn: { 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6, 
    backgroundColor: '#eee', 
    marginLeft: 8 
  },
  // Modal 相關樣式
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  modalKeyboardAvoidingView: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    width: '85%',
    maxWidth: 320,
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center'
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    marginBottom: 8
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#f9f9f9'
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 6
  },
  modalCancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd'
  },
  modalConfirmButton: {
    backgroundColor: '#007AFF'
  },
  modalCancelText: {
    color: '#666',
    fontSize: 16
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  // 驗證錯誤樣式
  rowError: {
    borderBottomColor: '#ff4444',
    borderBottomWidth: 2
  },
  rowLabelError: {
    color: '#ff4444'
  },
  rowValueInputError: {
    borderBottomColor: '#ff4444',
    borderBottomWidth: 2,
    color: '#ff4444'
  },
  validationErrorText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 38, // 對齊圖標和標籤的位置
    marginBottom: 8
  }
});
