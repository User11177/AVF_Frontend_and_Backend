//新增帳號
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Stack, useRouter } from 'expo-router';

import { API_URL } from '../../utils/appgol_config';
import { authFetch } from '../../utils/authFetch';

export default function AddUserScreen() {
  const router = useRouter();

  // 1. 移除 role 相關 state
  const [fullName, setFullName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [mrn, setMrn] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('patient'); // 預設為病患

  const handleSubmit = async () => {
    if (!fullName || !idNumber || !phone || !email || !password) {
      Alert.alert('錯誤', '基本欄位皆為必填，密碼也必填');
      return;
    }
    const payload = {
      full_name: fullName,
      id_number: idNumber,
      mrn: mrn || undefined,
      phone,
      email,
      password,
      birthdate: birthdate || undefined,
      address: address || undefined,
      emergency_name: emergencyName || undefined,
      emergency_phone: emergencyPhone || undefined,
      email_verified: 0,
      phone_verified: 0,
      role, // 一定要有
    };

    console.log(' 準備送出 payload:', payload);

    try {
      const res = await authFetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        Alert.alert('成功', '帳號新增成功');
        router.replace('/admin/users');
      } else {
        const text = await res.text();  
        console.error('後端錯誤：', text);
        throw new Error(`HTTP ${res.status} - ${text}`);
      }
    } catch (err: any) {
      console.error('發送錯誤：', err);
      Alert.alert('錯誤', err.message);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>新增帳號</Text>

        <Text style={styles.label}>選擇角色：</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={role}
            onValueChange={setRole}
          >
            <Picker.Item label="管理員" value="admin" />
            <Picker.Item label="醫師" value="doctor" />
            <Picker.Item label="病患" value="patient" />
          </Picker>
        </View>
        <Text style={{ marginBottom: 12, color: '#888' }}>目前選擇角色：{role === 'admin' ? '管理員' : role === 'doctor' ? '醫師' : '病患'}</Text>

        {/* 2. 表單只顯示 users 表有的欄位 */}
        <TextInput style={styles.input} placeholder="姓名" value={fullName} onChangeText={setFullName} />
        <TextInput style={styles.input} placeholder="身分證字號" value={idNumber} onChangeText={setIdNumber} />
        <TextInput style={styles.input} placeholder="病例號(MRN)" value={mrn} onChangeText={setMrn} />
        <TextInput style={styles.input} placeholder="電話" value={phone} onChangeText={setPhone} />
        <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="生日（YYYY-MM-DD）" value={birthdate} onChangeText={setBirthdate} />
        <TextInput style={styles.input} placeholder="地址" value={address} onChangeText={setAddress} />
        <TextInput style={styles.input} placeholder="緊急聯絡人" value={emergencyName} onChangeText={setEmergencyName} />
        <TextInput style={styles.input} placeholder="緊急聯絡人電話" value={emergencyPhone} onChangeText={setEmergencyPhone} />
        <TextInput style={styles.input} placeholder="密碼" value={password} onChangeText={setPassword} secureTextEntry />

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
          <Text style={styles.submitText}>送出</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f7f7f7', // 頁面背景色（亮灰）
    minHeight: '100%',          // 保證撐滿全頁
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 16, 
    color: '#222',              // 文字也固定深色
  },
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#222' },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#fff',    // Picker區域也是白底
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    backgroundColor: '#fff',     
    color: '#222',             
  },
  submitBtn: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  submitText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
