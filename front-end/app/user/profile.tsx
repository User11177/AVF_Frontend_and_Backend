import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, Platform, Image } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { API_URL } from '../../utils/appgol_config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Google from 'expo-auth-session/providers/google';
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
  const [changeOtpSent, setChangeOtpSent] = useState(false);
  const [changeOtp, setChangeOtp] = useState('');
  const [changeLoading, setChangeLoading] = useState(false);

  // 2. Google 連結流程參考 index.tsx
  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    clientId: '794306785311-lrr23m7g6fv43vibr8nebteqdas9ipj2.apps.googleusercontent.com',
    redirectUri: 'https://auth.expo.io/@user1117/rnProject',  // 使用 Expo 認證服務
    scopes: ['openid', 'profile', 'email'],
    // 移除 responseType，讓 Expo 自動處理
  });
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const id_token = (googleResponse.authentication as any)?.idToken || (googleResponse.authentication as any)?.id_token;
      if (id_token) {
        setLoading(true);
        fetch(`${API_URL}/api/auth/google-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token })
        })
          .then(res => res.json())
          .then(async data => {
            if (data.success) {
              await AsyncStorage.setItem('access_token', data.token);
              if (data.refresh_token) {
                await AsyncStorage.setItem('refresh_token', data.refresh_token);
              }
                             await AsyncStorage.setItem('user_id', String(data.user.id || ''));
               await AsyncStorage.setItem('user_phone', data.user.phone || '');
               await AsyncStorage.setItem('user_email', data.user.email || '');
               await AsyncStorage.setItem('user_id_number', data.user.id_number || '');
               await AsyncStorage.setItem('user_birthdate', data.user.birthdate || '');
               await AsyncStorage.setItem('user_mrn', data.user.mrn || '');
              Alert.alert('Google 連結成功');
              setProfile(data.user);
            } else {
              Alert.alert('錯誤', data.message || 'Google 連結失敗');
            }
          })
          .catch(() => Alert.alert('錯誤', 'Google 連結失敗'))
          .finally(() => setLoading(false));
      }
    }
  }, [googleResponse]);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const userId = await AsyncStorage.getItem('user_id');
        const phone = await AsyncStorage.getItem('user_phone');
        const email = await AsyncStorage.getItem('user_email');
        let url = '';
        if (userId) {
          url = `${API_URL}/api/user/profile?id=${userId}`;
        } else if (phone) {
          url = `${API_URL}/api/user/profile?phone=${phone}`;
        } else if (email) {
          url = `${API_URL}/api/user/profile?email=${email}`;
        } else {
          if (isMounted) setError('找不到用戶識別資訊');
          if (isMounted) setLoading(false);
          return;
        }
        const res = await authFetch(url);
        const data = await res.json();
        if (!data.user) throw new Error('找不到用戶');
        if (isMounted) setProfile(data.user);
      } catch (err) {
        if (isMounted) setError('無法取得個人資料');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchProfile();
    return () => { isMounted = false; };
  }, []);

   
  const handleVerify = async (type: 'email'|'phone') => {
    try {
      const res = await authFetch(`${API_URL}/api/auth/verify-${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [type]: profile[type], code: verifyCode })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('驗證成功');
        setProfile({ ...profile, [`${type}_verified`]: true });
        // 新增：同步後端驗證狀態
        try {
          await authFetch(`${API_URL}/api/user/profile/verify-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: profile.id, type, value: profile[type] })
          });
        } catch (e) {
          // 失敗時可提示或記錄
        }
      } else {
        Alert.alert('驗證失敗', data.message || '');
      }
      setShowVerify(null);
      setVerifyCode('');
    } catch {
      Alert.alert('驗證失敗');
    }
  };

  const handleEdit = () => {
    setEditProfile(profile);
    setEditMode(true);
  };
  const handleSave = async () => {
    const emailChanged = editProfile.email !== profile.email;
    const phoneChanged = editProfile.phone !== profile.phone;
    if (emailChanged && !profile.email_verified) {
      Alert.alert('請先驗證新的 Email');
      return;
    }
    if (phoneChanged && !profile.phone_verified) {
      Alert.alert('請先驗證新的電話');
      return;
    }
    const payload = {
      ...(profile.id ? { id: profile.id } : {}),
      ...(profile.phone ? { phone: profile.phone } : {}),
      ...(editProfile.email ? { email: editProfile.email } : {}),
      id_number: editProfile.id_number,
      mrn: editProfile.mrn,
      full_name: editProfile.full_name,
      birthdate: editProfile.birthdate,
      address: editProfile.address,
      emergency_name: editProfile.emergency_name,
      emergency_phone: editProfile.emergency_phone,
      new_phone: editProfile.phone !== profile.phone ? editProfile.phone : undefined,
      email_verified: profile.email_verified,
      phone_verified: profile.phone_verified
    };
    console.log('儲存個資 payload:', payload);
    if (!editProfile.phone) {
      Alert.alert('請先填寫電話');
      return;
    }
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

  // 3. 變更 email/phone 流程
  const handleSendChangeOtp = async () => {
    if (!newFieldValue) return Alert.alert('請輸入新' + (changeField === 'email' ? 'Email' : '電話'));
    setChangeLoading(true);
    const api = changeField === 'email' ? '/api/auth/request-otp' : '/api/auth/request-otp';
    const payload = changeField === 'email' ? { email: newFieldValue } : { phone: newFieldValue };
    fetch(`${API_URL}${api}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setChangeOtpSent(true);
          Alert.alert('驗證碼已發送');
        } else {
          Alert.alert('錯誤', data.message || '發送失敗');
        }
      })
      .catch(() => Alert.alert('錯誤', '發送失敗'))
      .finally(() => setChangeLoading(false));
  };
  const handleVerifyChangeOtp = async () => {
    if (!changeOtp) return Alert.alert('請輸入驗證碼');
    setChangeLoading(true);
    const api = changeField === 'email' ? '/api/auth/verify-otp' : '/api/auth/verify-otp';
    const payload = changeField === 'email' ? { email: newFieldValue, code: changeOtp } : { phone: newFieldValue, code: changeOtp };
    fetch(`${API_URL}${api}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // 驗證通過，更新 profile 狀態
          setProfile({ ...profile, [changeField as string]: newFieldValue, [`${changeField as string}_verified`]: true });
          setChangeField(null);
          setNewFieldValue('');
          setChangeOtp('');
          setChangeOtpSent(false);
          Alert.alert('變更成功');
        } else {
          Alert.alert('錯誤', data.message || '驗證失敗');
        }
      })
      .catch(() => Alert.alert('錯誤', '驗證失敗'))
      .finally(() => setChangeLoading(false));
  };

 

  if (loading) return <Text style={{ padding: 20 }}>載入中...</Text>;
  if (error) return <Text style={{ padding: 20, color: 'red' }}>{error}</Text>;

  const isGoogleLinked = !!profile?.google_id;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.avatarWrapper}>
        <FontAwesome name="cog" size={80} color="#999" />
      </View>
      <Text style={styles.name}>
        {profile?.full_name || profile?.email || profile?.phone || '(未命名)'}
      </Text>
      <Text style={styles.subtitle}>
        {profile?.email || profile?.phone || ''}
      </Text>

      <View style={styles.infoList}>
        <InfoField label="姓名" icon="user" value={editMode ? (editProfile.full_name ?? '') : (profile?.full_name ?? '')} editable={editMode} onChange={v => setEditProfile({ ...editProfile, full_name: v })} />
        {/* 新增身分證字號欄位 */}
        <InfoField label="身分證字號" icon="id-card" value={editMode ? (editProfile.id_number ?? '') : (profile?.id_number ?? '')} editable={editMode} onChange={v => setEditProfile({ ...editProfile, id_number: v })} />
        <InfoField label="病例號(MRN)" icon="hospital-o" value={editMode ? (editProfile.mrn ?? '') : (profile?.mrn ?? '')} editable={editMode} onChange={v => setEditProfile({ ...editProfile, mrn: v })} />
        <InfoField label="Email" icon="envelope" value={profile?.email ?? ''} editable={false} extra={<TouchableOpacity onPress={()=>setChangeField('email')}><Text style={{color:'#007AFF'}}>變更</Text></TouchableOpacity>} />
        <InfoField label="電話" icon="phone" value={profile?.phone ?? ''} editable={false} extra={<TouchableOpacity onPress={()=>setChangeField('phone')}><Text style={{color:'#007AFF'}}>變更</Text></TouchableOpacity>} />
        <InfoField
          label="生日"
          icon="calendar"
          value={editMode ? (editProfile.birthdate ?? '') : (profile?.birthdate ?? '')}
          editable={editMode}
          onPress={editMode ? () => setShowDatePicker(true) : undefined}
        />
        {editMode && showDatePicker && (
          <DateTimePicker
            value={editProfile.birthdate ? new Date(editProfile.birthdate) : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => {
              setShowDatePicker(false);
              if (date) setEditProfile({ ...editProfile, birthdate: date.toISOString().slice(0, 10) });
            }}
          />
        )}
        <InfoField label="地址" icon="home" value={editMode ? (editProfile.address ?? '') : (profile?.address ?? '')} editable={editMode} onChange={v => setEditProfile({ ...editProfile, address: v })} />
        <InfoField label="緊急聯絡人" icon="user" value={editMode ? (editProfile.emergency_name ?? '') : (profile?.emergency_name ?? '')} editable={editMode} onChange={v => setEditProfile({ ...editProfile, emergency_name: v })} />
        <InfoField label="緊急聯絡電話" icon="phone" value={editMode ? (editProfile.emergency_phone ?? '') : (profile?.emergency_phone ?? '')} editable={editMode} onChange={v => setEditProfile({ ...editProfile, emergency_phone: v })} />
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
          if (!isGoogleLinked) googlePromptAsync();
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
      {/* 驗證碼輸入彈窗 */}
      <Modal visible={!!showVerify} transparent animationType="slide">
        <View style={{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'rgba(0,0,0,0.3)'}}>
          <View style={{backgroundColor:'#fff',padding:20,borderRadius:10,width:300}}>
            <Text>請輸入{showVerify==='email'?'Email':'電話'}驗證碼</Text>
            <TextInput
              value={verifyCode}
              onChangeText={setVerifyCode}
              style={{borderWidth:1,borderColor:'#ccc',marginVertical:10,padding:8}}
              keyboardType="number-pad"
            />
            <View style={{flexDirection:'row',justifyContent:'flex-end'}}>
              <TouchableOpacity onPress={()=>setShowVerify(null)} style={{marginRight:10}}><Text>取消</Text></TouchableOpacity>
              <TouchableOpacity onPress={()=>handleVerify(showVerify!)} style={styles.verifyBtn}><Text style={{color:'#007AFF'}}>送出</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* 變更 Email/電話彈窗 */}
      <Modal visible={!!changeField} transparent animationType="slide">
        <View style={{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'rgba(0,0,0,0.3)'}}>
          <View style={{backgroundColor:'#fff',padding:20,borderRadius:10,width:300}}>
            <Text>請輸入新{changeField==='email'?'Email':'電話'}</Text>
            <TextInput
              value={newFieldValue}
              onChangeText={setNewFieldValue}
              style={{borderWidth:1,borderColor:'#ccc',marginVertical:10,padding:8}}
              keyboardType={changeField==='email'?'email-address':'number-pad'}
              autoCapitalize="none"
            />
            {changeOtpSent && (
              <>
                <Text>請輸入驗證碼</Text>
                <TextInput
                  value={changeOtp}
                  onChangeText={setChangeOtp}
                  style={{borderWidth:1,borderColor:'#ccc',marginVertical:10,padding:8}}
                  keyboardType="number-pad"
                />
              </>
            )}
            <View style={{flexDirection:'row',justifyContent:'flex-end'}}>
              <TouchableOpacity onPress={()=>{setChangeField(null);setNewFieldValue('');setChangeOtp('');setChangeOtpSent(false);}} style={{marginRight:10}}><Text>取消</Text></TouchableOpacity>
              {!changeOtpSent ? (
                <TouchableOpacity onPress={handleSendChangeOtp} disabled={changeLoading}><Text style={{color:'#007AFF'}}>發送驗證碼</Text></TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handleVerifyChangeOtp} disabled={changeLoading}><Text style={{color:'#007AFF'}}>驗證</Text></TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
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
}
const InfoField = ({ icon, label, value, editable, onChange, onPress, extra }: InfoFieldProps) => (
  <View style={styles.row}>
    <FontAwesome name={icon} size={20} color="#333" style={{ width: 30 }} />
    <Text style={styles.rowLabel}>{label}：</Text>
    {editable && onPress ? (
      <TouchableOpacity style={{ flex: 1 }} onPress={onPress}>
        <Text style={[styles.rowValue, { color: '#007AFF' }]}>{value || '請選擇'}</Text>
      </TouchableOpacity>
    ) : editable ? (
      <TextInput
        style={styles.rowValueInput}
        value={value}
        onChangeText={onChange}
      />
    ) : (
      <Text style={styles.rowValue}>{value}</Text>
    )}
    {extra}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F5F5F5' },
  avatarWrapper: { marginTop: 80, alignItems: 'center', marginBottom: 20 },
  name: { fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: 20 },
  infoList: { marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#DDD' },
  rowLabel: { flexShrink: 0, fontSize: 16, marginRight: 8 },
  rowValue: { fontSize: 16, color: '#333' },
  rowValueInput: { fontSize: 16, color: '#333', flex: 1, borderBottomWidth: 1, borderColor: '#CCC' },
  editBtn: { marginTop: 30, backgroundColor: '#007AFF', padding: 12, borderRadius: 10, alignItems: 'center' },
  editText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  verifyBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#eee', marginLeft: 8 },
});
