import React from 'react';
import { Stack } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function AdminDashboard() {
  const router = useRouter(); 
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>管理員控制台</Text>

        <TouchableOpacity style={styles.card} onPress={() => router.push('/admin/users')}>
          <Text style={styles.cardTitle}>帳號管理</Text>
          <Text>新增 / 編輯 / 停用醫師與病人帳號</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => router.push('/admin/logs')}>
          <Text style={styles.cardTitle}>資料審核與日誌</Text>
          <Text>檢視偵測紀錄、分析結果、上傳資料</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => router.push('/admin/notify')}>
          <Text style={styles.cardTitle}>通知與推播</Text>
          <Text>推送系統公告</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => router.push('/admin/settings')}>
          <Text style={styles.cardTitle}>權限與維護</Text>
          <Text>帳號權限設定 / 資安監控 / 備份</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  bg: {
    backgroundColor: '#f7f7f7',  
  },
  container: {
    padding: 20,
    gap: 20,
    backgroundColor: '#f7f7f7',  
    minHeight: '100%',          
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#222',  
  },
  card: {
    backgroundColor: '#fff',  
    padding: 20,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#222',  
  },
  cardDesc: {
    color: '#555',  
    fontSize: 14,
  },
});