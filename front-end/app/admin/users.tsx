import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Alert
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { API_URL } from '../../utils/appgol_config';
import { authFetch } from '../../utils/authFetch';

interface User {
  id: number;
  full_name: string;
  id_number: string;
  email: string;
  phone: string;
  birthdate?: string;
  address?: string;
  emergency_name?: string;
  emergency_phone?: string;
  email_verified?: number;
  phone_verified?: number;
}

export default function UserManagementScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [filtered, setFiltered] = useState<User[]>([]);

  useEffect(() => {
    authFetch(`${API_URL}/api/users`)
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setFiltered(data);
      })
      .catch(err => {
        console.error('無法取得用戶資料:', err);
        Alert.alert('錯誤', '無法載入帳號資料');
      });
  }, []);

  useEffect(() => {
    const lower = search.toLowerCase();
    setFiltered(users.filter(u =>
      (u.full_name ?? '').toLowerCase().includes(lower) ||
      (u.id_number ?? '').toLowerCase().includes(lower) ||
      (u.email ?? '').toLowerCase().includes(lower) ||
      (u.phone ?? '').toLowerCase().includes(lower)
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
    Alert.alert('刪除帳號', `確定要刪除 ${user.full_name} 嗎？`, [
      { text: '取消' },
      {
        text: '確認', onPress: async () => {
          try {
                const res = await authFetch(`${API_URL}/api/users/${user.id}`, {
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
          placeholder="輸入ID或身分證搜尋"
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#999"
        />

        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/admin/new')}>
          <Text style={styles.addText}>＋ 新增帳號</Text>
        </TouchableOpacity>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.userCard}>
              <Text style={styles.name}>{item.full_name}</Text>
              <Text style={styles.info}>身分證：{item.id_number || '未提供'}</Text>
              <Text style={styles.info}>Email：{item.email || '未提供'}</Text>
              <Text style={styles.info}>電話：{item.phone || '未提供'}</Text>
              <Text style={styles.info}>生日：{item.birthdate || '未提供'}</Text>
              <Text style={styles.info}>地址：{item.address || '未提供'}</Text>
              <Text style={styles.info}>緊急聯絡人：{item.emergency_name || '未提供'}</Text>
              <Text style={styles.info}>緊急聯絡電話：{item.emergency_phone || '未提供'}</Text>
              <Text style={styles.info}>Email驗證：{item.email_verified ? '已驗證' : '未驗證'}</Text>
              <Text style={styles.info}>電話驗證：{item.phone_verified ? '已驗證' : '未驗證'}</Text>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => router.push(`/admin/edit-user?id=${item.id}`)}>
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
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f7f7f7', // 固定頁面背景亮灰色
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#222', // 保證可讀
  },
  search: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#fff', // 輸入框固定白底
    color: '#222',           // 輸入文字顏色
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
    backgroundColor: '#fff', // 每張卡片都是白底
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  info: {
    fontSize: 14,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  link: {
    color: '#007AFF',
    fontWeight: '500',
  },
});

