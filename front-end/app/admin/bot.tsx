import React from 'react';
import { Stack } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AdminDashboard() {
  const router = useRouter();
  
  // 登出處理函數
  const handleLogout = async () => {
    Alert.alert(
      '確認登出',
      '確定要登出嗎？',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '登出', 
          style: 'destructive',
          onPress: async () => {
            try {
              // 清除所有本地儲存的用戶資料
              await AsyncStorage.removeItem('access_token');
              await AsyncStorage.removeItem('refresh_token');
              await AsyncStorage.removeItem('user_id');
              await AsyncStorage.removeItem('user_phone');
              await AsyncStorage.removeItem('user_email');
              await AsyncStorage.removeItem('user_full_name');
              await AsyncStorage.removeItem('user_id_number');
              await AsyncStorage.removeItem('user_birthdate');
              await AsyncStorage.removeItem('user_mrn');
              await AsyncStorage.removeItem('user_address');
              await AsyncStorage.removeItem('user_emergency_name');
              await AsyncStorage.removeItem('user_emergency_phone');
              await AsyncStorage.removeItem('user_role');
              
              console.log('[Admin] 用戶已登出，清除所有本地資料');
              
              // 導向登入頁面
              router.replace('/');
            } catch (error) {
              console.error('[Admin] 登出時發生錯誤:', error);
              Alert.alert('錯誤', '登出失敗，請稍後再試');
            }
          }
        }
      ]
    );
  };
  
  return (
    <>
      <Stack.Screen 
        options={{ 
          title: '管理員控制台',
          headerStyle: { backgroundColor: '#2196F3' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          headerRight: () => (
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutText}>登出</Text>
            </TouchableOpacity>
          )
        }} 
      />
      
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>管理員控制台</Text>
          <TouchableOpacity style={styles.logoutCardButton} onPress={handleLogout}>
            <Text style={styles.logoutCardText}>登出</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.card} onPress={() => router.push('/admin/users')}>
          <Text style={styles.cardTitle}>帳號管理</Text>
          <Text>新增 / 編輯 / 停用醫師與病人帳號</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => router.push('/admin/logs')}>
          <Text style={styles.cardTitle}>系統管理</Text>
          <Text>系統維護模式 / 狀態檢查 / 用戶統計</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => router.push('/admin/notify')}>
          <Text style={styles.cardTitle}>推播管理</Text>
          <Text>推送系統公告</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => router.push('/admin/settings')}>
          <Text style={styles.cardTitle}>日誌管理</Text>
          <Text>錯誤熱點統計 / 日誌管理 / CSV匯出</Text>
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
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ff4444',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginRight: 16
  },
  logoutText: {
    fontSize: 14,
    color: '#ff4444',
    fontWeight: 'bold',
    textDecorationLine: 'underline'
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  logoutCardButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ff4444'
  },
  logoutCardText: {
    fontSize: 14,
    color: '#ff4444',
    fontWeight: 'bold',
    textDecorationLine: 'underline'
  }
});