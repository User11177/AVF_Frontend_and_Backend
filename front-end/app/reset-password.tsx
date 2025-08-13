import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { API_URL } from '../utils/appgol_config';
import { useRouter } from 'expo-router';

export default function ResetPassword() {
  const [step, setStep] = useState(1);
  const [account, setAccount] = useState(''); // phone or email
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 發送驗證碼
  const handleSendCode = () => {
    if (!account) return Alert.alert('請輸入手機號碼或 Email');
    setLoading(true);
    fetch(`${API_URL}/api/auth/request-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account })
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

  // 直接驗證驗證碼並重設密碼
  const handleResetPassword = () => {
    if (!code) return Alert.alert('請輸入驗證碼');
    if (!newPassword) return Alert.alert('請輸入新密碼');
    setLoading(true);
    fetch(`${API_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account, code, new_password: newPassword })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          Alert.alert('密碼重設成功', '', [
            { text: '返回登入', onPress: () => router.replace('/') }
          ]);
        } else {
          Alert.alert('錯誤', data.message || '重設失敗');
        }
      })
      .catch(() => Alert.alert('錯誤', '重設失敗'))
      .finally(() => setLoading(false));
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <Text style={styles.header}>忘記密碼</Text>
        {step === 1 && (
          <>
            <TextInput
              style={styles.input}
              placeholder="手機號碼或 Email"
              value={account}
              onChangeText={setAccount}
              autoCapitalize="none"
              keyboardType="default"
              autoFocus
            />
            <TouchableOpacity style={styles.btn} onPress={handleSendCode} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>發送驗證碼</Text>}
            </TouchableOpacity>
          </>
        )}
        {step === 2 && (
          <>
            <Text style={styles.tip}>驗證碼已發送至 {account}</Text>
            <TextInput
              style={styles.input}
              placeholder="輸入驗證碼"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="新密碼"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <TouchableOpacity style={styles.btn} onPress={handleResetPassword} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>完成重設</Text>}
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
  wrapper: {
    flex: 1,
    backgroundColor: '#F5F7FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
