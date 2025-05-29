import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Alert
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { API_URL } from '../appgol_config';
interface User {
  id: number;
  name: string;
  role: 'admin' | 'doctor' | 'patient';
  id_number: string | null;
  phone: string | null;
}

export default function UserManagementScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [filtered, setFiltered] = useState<User[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/users`)
      .then(res => res.json())
      .then(data => {
        const sanitized = data.map((u: User) => ({
          ...u,
          id_number: u.id_number ?? '',
          phone: u.phone ?? '',
        }));
        setUsers(sanitized);
        setFiltered(sanitized);
      })
      .catch(err => {
        console.error('無法取得用戶資料:', err);
        Alert.alert('錯誤', '無法載入帳號資料');
      });
  }, []);

  useEffect(() => {
    const lower = search.toLowerCase();
    setFiltered(users.filter(u =>
      u.name.toLowerCase().includes(lower) ||
      (u.id_number ?? '').toLowerCase().includes(lower)
    ));
  }, [search, users]);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'doctor': return '醫師';
      case 'admin': return '管理員';
      case 'patient': return '病人';
      default: return '未知';
    }
  };

  const handleDelete = (user: User) => {
    Alert.alert('刪除帳號', `確定要刪除 ${user.name} 嗎？`, [
      { text: '取消' },
      {
        text: '確認', onPress: async () => {
          try {
            const res = await fetch(`http://192.168.1.2:8000/api/users/${user.id}`, {
              method: 'DELETE',
            });
            if (res.ok) {
              setUsers(prev => prev.filter(u => u.id !== user.id));
            } else {
              throw new Error('刪除失敗');
            }
          } catch {
            Alert.alert('錯誤', '無法刪除帳號');
          }
        }
      }
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <Text style={styles.title}>帳號管理</Text>

        <TextInput
          style={styles.search}
          placeholder="輸入姓名或身分證搜尋"
          value={search}
          onChangeText={setSearch}
        />

        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/admin/new')}>
          <Text style={styles.addText}>＋ 新增帳號</Text>
        </TouchableOpacity>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.userCard}>
              <Text style={styles.name}>
                {item.name}（{getRoleLabel(item.role)}）
              </Text>
              <Text style={styles.info}>身分證：{item.id_number || '未提供'}</Text>
              <Text style={styles.info}>電話：{item.phone || '未提供'}</Text>

              <View style={styles.actions}>
                <TouchableOpacity onPress={() => router.push(`/admin/users/edit/${item.id}`)}>
                  <Text style={styles.link}>編輯</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)}>
                  <Text style={[styles.link, { color: 'red' }]}>刪除</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  search: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  addBtn: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  addText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  userCard: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  name: { fontSize: 18, fontWeight: 'bold' },
  info: { fontSize: 14, color: '#666' },
  actions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  link: { color: '#007AFF', fontWeight: '500' },
});
