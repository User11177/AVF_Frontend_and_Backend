import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { API_URL } from '../../utils/appgol_config';
import { authFetch } from '../../utils/authFetch';

export default function EditUserScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>({});
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!id) return;
    authFetch(`${API_URL}/api/users/${id}`)
      .then((res: Response) => res.json())
      .then((data: any) => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => {
        Alert.alert('錯誤', '無法取得用戶資料');
        setLoading(false);
      });
  }, [id]);

  const handleSave = async () => {
    if (!user.full_name || !user.id_number || !user.phone || !user.email) {
      Alert.alert('錯誤', '基本欄位皆為必填');
      return;
    }
    const payload: any = {
      full_name: user.full_name,
      id_number: user.id_number,
      mrn: user.mrn || undefined,
      phone: user.phone,
      email: user.email,
      birthdate: user.birthdate || undefined,
      address: user.address || undefined,
      emergency_name: user.emergency_name || undefined,
      emergency_phone: user.emergency_phone || undefined,
      role: user.role,
    };
    if (password) payload.password = password;
    try {
      const res = await authFetch(`${API_URL}/api/users/${id}` , {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        Alert.alert('成功', '帳號已更新');
        router.replace('/admin/users');
      } else {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} - ${text}`);
      }
    } catch (err: any) {
      Alert.alert('錯誤', err.message);
    }
  };

  if (loading) return <Text style={{ padding: 20 }}>載入中...</Text>;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>編輯帳號</Text>
        <TextInput style={styles.input} placeholder="姓名" value={user.full_name} onChangeText={v => setUser({ ...user, full_name: v })} />
        <TextInput style={styles.input} placeholder="身分證字號" value={user.id_number} onChangeText={v => setUser({ ...user, id_number: v })} />
        <TextInput style={styles.input} placeholder="病例號(MRN)" value={user.mrn || ''} onChangeText={v => setUser({ ...user, mrn: v })} />
        <TextInput style={styles.input} placeholder="電話" value={user.phone} onChangeText={v => setUser({ ...user, phone: v })} />
        <TextInput style={styles.input} placeholder="Email" value={user.email} onChangeText={v => setUser({ ...user, email: v })} keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="生日（YYYY-MM-DD）" value={user.birthdate || ''} onChangeText={v => setUser({ ...user, birthdate: v })} />
        <TextInput style={styles.input} placeholder="地址" value={user.address || ''} onChangeText={v => setUser({ ...user, address: v })} />
        <TextInput style={styles.input} placeholder="緊急聯絡人" value={user.emergency_name || ''} onChangeText={v => setUser({ ...user, emergency_name: v })} />
        <TextInput style={styles.input} placeholder="緊急聯絡人電話" value={user.emergency_phone || ''} onChangeText={v => setUser({ ...user, emergency_phone: v })} />
        <TextInput style={styles.input} placeholder="新密碼（不修改可留空）" value={password} onChangeText={setPassword} secureTextEntry />
        <TouchableOpacity style={styles.submitBtn} onPress={handleSave}>
          <Text style={styles.submitText}>儲存</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f7f7f7',
    minHeight: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#222',
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
