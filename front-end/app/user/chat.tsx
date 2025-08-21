// user/chat.tsx
// 病患聊天入口 - 直接進入醫療諮詢聊天室

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Alert,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { authFetch } from '../../utils/authFetch';
import { API_URL } from '../../utils/appgol_config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PatientChatPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initPatientChat = async () => {
      try {
        console.log('[PatientChat] 初始化病患聊天室');
        
        // 從後端獲取用戶角色信息
        try {
          const userResponse = await authFetch(`${API_URL}/api/user/current-role`);
          const userData = await userResponse.json();
          
          if (userData.role !== 'patient') {
            Alert.alert('錯誤', '只有病患可以使用此功能');
            router.back();
            return;
          }
        } catch (error) {
          console.error('[PatientChat] 獲取用戶角色失敗:', error);
          Alert.alert('錯誤', '無法驗證用戶權限');
          router.back();
          return;
        }

        // 創建或取得病患的聊天室
        const response = await authFetch(`${API_URL}/api/chat/create-or-get`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        console.log('[PatientChat] 聊天室響應:', data);
        
        if (data.success && data.chat_room) {
          // 直接跳轉到聊天室
          router.replace({
            pathname: '/chat/room',
            params: { 
              chatRoomId: data.chat_room.id,
              patientName: data.chat_room.patient_name || '我',
              patientId: data.chat_room.patient_id
            }
          });
        } else {
          console.error('[PatientChat] 創建聊天室失敗:', data);
          Alert.alert('錯誤', '無法創建聊天室，請稍後再試');
          router.back();
        }
      } catch (error) {
        console.error('[PatientChat] 初始化錯誤:', error);
        Alert.alert('錯誤', '網路連線失敗');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    initPatientChat();
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: '醫療諮詢',
          headerStyle: { backgroundColor: '#2196F3' },
          headerTintColor: '#fff'
        }} 
      />
      
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>準備諮詢室...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});