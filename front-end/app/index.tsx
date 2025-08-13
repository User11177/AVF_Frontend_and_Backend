import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import { API_URL } from '../utils/appgol_config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';


export default function Login() {
  const [account, setAccount] = useState(''); // phone or email
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '794306785311-lrr23m7g6fv43vibr8nebteqdas9ipj2.apps.googleusercontent.com',
    redirectUri: 'https://auth.expo.io/@user1117/rnProject',
    scopes: ['openid', 'profile', 'email'],
  });
  WebBrowser.maybeCompleteAuthSession();

  useEffect(() => {
    if (response?.type === 'success') {
      const id_token = (response.authentication as any)?.idToken || (response.authentication as any)?.id_token;
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
              Alert.alert('登入成功');
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
          .catch(() => Alert.alert('錯誤', 'Google 登入失敗'))
          .finally(() => setLoading(false));
      }
    }
  }, [response]);

  const handleLogin = async () => {
    if (!account) return Alert.alert('請輸入手機號碼或 Email');
    if (!password) return Alert.alert('請輸入密碼');
    setLoading(true);
    fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account, password })
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
          Alert.alert('登入成功');
          if (data.user.role === 'admin') {
            router.replace('/admin/bot');
          } else if (data.user.role === 'doctor') {
            router.replace('/doctor/doctor');
          } else {
            router.replace('/user/patient');
          }
        } else {
          Alert.alert('錯誤', data.message || '登入失敗');
        }
      })
      .catch(() => Alert.alert('錯誤', '登入失敗'))
      .finally(() => setLoading(false));
  };

  const handleGoogleLogin = () => {
    promptAsync();
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <Text style={styles.header}>登入</Text>
        <TextInput
          style={styles.input}
          placeholder="手機號碼或 Email"
          value={account}
          onChangeText={setAccount}
          autoCapitalize="none"
          keyboardType="default"
        />
        <TextInput
          style={styles.input}
          placeholder="密碼"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>登入</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/reset-password')}>
          <Text style={styles.linkText}>忘記密碼？</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/register')}>
          <Text style={styles.linkText}>註冊新帳號</Text>
        </TouchableOpacity>
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
