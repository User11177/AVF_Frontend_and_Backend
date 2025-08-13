import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { API_URL } from '../utils/appgol_config';
import { useRouter } from 'expo-router';

export default function Register() {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 發送驗證碼
  const handleSendCode = () => {
    if (!phone) return Alert.alert('請輸入手機號碼');
    setLoading(true);
    fetch(`${API_URL}/api/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStep(2);
        } else {
          Alert.alert('錯誤', data.message || '發送失敗');
        }
      })
      .catch(() => Alert.alert('錯誤', '發送失敗'))
      .finally(() => setLoading(false));
  };

  // 驗證驗證碼
  const handleVerifyCode = () => {
    if (!code) return Alert.alert('請輸入驗證碼');
    setLoading(true);
    fetch(`${API_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStep(3);
        } else {
          Alert.alert('錯誤', data.message || '驗證失敗');
        }
      })
      .catch(() => Alert.alert('錯誤', '驗證失敗'))
      .finally(() => setLoading(false));
  };

  // 設置密碼
  const handleSetPassword = () => {
    if (!password) return Alert.alert('請輸入密碼');
    setLoading(true);
    fetch(`${API_URL}/api/auth/set-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          Alert.alert('註冊成功，請登入');
          router.replace('/');
        } else {
          Alert.alert('錯誤', data.message || '註冊失敗');
        }
      })
      .catch(() => Alert.alert('錯誤', '註冊失敗'))
      .finally(() => setLoading(false));
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <Text style={styles.header}>註冊新帳號</Text>
        {step === 1 && (
          <>
            <TextInput
              style={styles.input}
              placeholder="手機號碼"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoFocus
            />
            <TouchableOpacity style={styles.btn} onPress={handleSendCode} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>發送驗證碼</Text>}
            </TouchableOpacity>
          </>
        )}
        {step === 2 && (
          <>
            <Text style={styles.tip}>驗證碼已發送至 {phone}</Text>
            <TextInput
              style={styles.input}
              placeholder="輸入驗證碼"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoFocus
            />
            <TouchableOpacity style={styles.btn} onPress={handleVerifyCode} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>驗證</Text>}
            </TouchableOpacity>
          </>
        )}
        {step === 3 && (
          <>
            <Text style={styles.tip}>請設置密碼</Text>
            <TextInput
              style={styles.input}
              placeholder="密碼"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoFocus
            />
            <TouchableOpacity style={styles.btn} onPress={handleSetPassword} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>完成註冊</Text>}
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity style={styles.linkBtn} onPress={() => router.replace('/')}> 
          <Text style={styles.linkText}>返回登入</Text>
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
  tip: { marginBottom: 10, color: '#888', fontSize: 15, textAlign: 'center' },
  linkBtn: { marginTop: 10 },
  linkText: { color: '#007AFF', fontSize: 15, textAlign: 'center' },
});
