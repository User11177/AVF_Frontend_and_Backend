import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Stack, useRouter } from 'expo-router';

import { API_URL } from '../appgol_config';

export default function AddUserScreen() {
  const router = useRouter();

  const [role, setRole] = useState<'admin' | 'doctor' | 'patient'>('admin');
  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  const handleSubmit = async () => {
    if (!name || !idNumber || !phone || !email || !password) {
      Alert.alert('錯誤', '基本欄位皆為必填');
      return;
    }
    if (role === 'patient' && (!address || !emergencyName || !emergencyPhone)) {
      Alert.alert('錯誤', '病患欄位皆為必填');
      return;
    }

    const payload = {
      name,
      role,
      id_number: idNumber,
      phone,
      email,
      password,
      ...(role === 'patient' && {
        address,
        emergency_name: emergencyName,
        emergency_phone: emergencyPhone
      })
    };

    console.log('🚀 準備送出 payload:', payload);

    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        Alert.alert('成功', '帳號新增成功');
        router.replace('/admin/users');
      } else {
        const text = await res.text(); // 注意：有可能不是 JSON！
        console.error('❌ 後端錯誤：', text);
        throw new Error(`HTTP ${res.status} - ${text}`);
      }
    } catch (err: any) {
      console.error('❌ 發送錯誤：', err);
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
            onValueChange={(itemValue) => {
              console.log('🧭 角色改為:', itemValue);
              setRole(itemValue);
            }}>
            <Picker.Item label="管理員" value="admin" />
            <Picker.Item label="醫師" value="doctor" />
            <Picker.Item label="病人" value="patient" />
          </Picker>
        </View>
        <Text style={{ marginBottom: 12, color: '#888' }}>目前選擇角色：{role}</Text>

        <TextInput style={styles.input} placeholder="姓名" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="身分證字號" value={idNumber} onChangeText={setIdNumber} />
        <TextInput style={styles.input} placeholder="電話" value={phone} onChangeText={setPhone} />
        <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="密碼" value={password} onChangeText={setPassword} secureTextEntry />

        {role === 'patient' && (
          <>
            <TextInput style={styles.input} placeholder="地址" value={address} onChangeText={setAddress} />
            <TextInput style={styles.input} placeholder="緊急聯絡人" value={emergencyName} onChangeText={setEmergencyName} />
            <TextInput style={styles.input} placeholder="緊急聯絡人電話" value={emergencyPhone} onChangeText={setEmergencyPhone} />
          </>
        )}

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
          <Text style={styles.submitText}>送出</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 12
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
