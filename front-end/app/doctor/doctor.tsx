import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import React from 'react';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DoctorHome() {
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
              
              console.log('[Doctor] 用戶已登出，清除所有本地資料');
              
              // 導向登入頁面
              router.replace('/');
            } catch (error) {
              console.error('[Doctor] 登出時發生錯誤:', error);
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
          title: '醫師首頁',
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
      
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>醫師首頁</Text>
          <TouchableOpacity style={styles.logoutCardButton} onPress={handleLogout}>
            <Text style={styles.logoutCardText}>登出</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity style={styles.card} onPress={() => router.push('/doctor/patient-search')}>
          <Text style={styles.cardTitle}>1. 搜尋病患與病歷檢視</Text>
          <Text>搜尋病患資料、查看病歷與AI檢測判斷結果</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.card} onPress={() => router.push('/chat')}>
          <Text style={styles.cardTitle}>2. 醫患對話</Text>
          <Text>與患者即時溝通、回覆訊息</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7', padding: 24 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 30, color: '#222', textAlign: 'center' },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 22, marginBottom: 22,
    shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8, color: '#222' },
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
    marginBottom: 20
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