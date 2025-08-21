// ============================================================================
// patient.tsx - 病患主介面頁面
// ============================================================================
// 
// 主要功能：
// 1. 顯示用戶基本資訊和健康狀態
// 2. 提供各種醫療服務快捷入口
// 3. 整合健康資訊管理功能
// 4. 支援掛號、AI 檢查等服務
// 5. 用戶登出功能
// 
// 頁面佈局：
// - 左上角：登出按鈕（紅色底線）
// - 右上角：個人設定按鈕
// - 中央：歡迎訊息、公告資訊、功能選單網格
// ============================================================================

import React, { useEffect, useState } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, 
  ScrollView, Alert, Linking 
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';           // 圖示庫
import { useRouter } from 'expo-router';                   // 路由導航
import { Stack } from 'expo-router';                       // 頁面堆疊
import { API_URL } from '../../utils/appgol_config';       // API 配置
import AsyncStorage from '@react-native-async-storage/async-storage'; // 本地儲存
import { authFetch } from '../../utils/authFetch';         // 認證請求工具

/**
 * 病患主介面元件
 * 
 * 主要功能：
 * 1. 顯示用戶基本資訊和健康狀態
 * 2. 提供各種醫療服務快捷入口
 * 3. 整合健康資訊管理功能
 * 4. 支援掛號、AI 檢查等服務
 */
const HealthInfo = () => {
  const router = useRouter();
  
  // === 狀態管理 ===
  const [healthInfo, setHealthInfo] = useState<any>(null);      // 健康資訊
  const [loading, setLoading] = useState(true);                 // 載入狀態
  const [error, setError] = useState<string | null>(null);      // 錯誤狀態
  const [userProfile, setUserProfile] = useState<any>(null);    // 用戶資料
  const [profileLoading, setProfileLoading] = useState(true);   // 資料載入狀態

  // === 初始化處理 ===
  useEffect(() => {
    /**
     * 初始化用戶資料
     * 
     * 流程：
     * 1. 從本地儲存讀取基本資料
     * 2. 檢查登入狀態
     * 3. 如需要則從伺服器更新完整資料
     */
    const initUserProfile = async () => {
      try {
        // === 從本地儲存取得基本資料 ===
        const userId = await AsyncStorage.getItem('user_id');
        const phone = await AsyncStorage.getItem('user_phone');
        const email = await AsyncStorage.getItem('user_email');
        const fullName = await AsyncStorage.getItem('user_full_name');
        const idNumber = await AsyncStorage.getItem('user_id_number');
        const birthdate = await AsyncStorage.getItem('user_birthdate');
        const mrn = await AsyncStorage.getItem('user_mrn');

        // 組合基本個人資料
        const basicProfile = {
          id: userId,
          phone,
          email,
          full_name: fullName,
          id_number: idNumber,
          birthdate,
          mrn
        };

        // === 登入狀態檢查 ===
        if (!userId && !phone && !email) {
          Alert.alert(
            '未登入', 
            '找不到登入資訊，請重新登入',
            [
              { text: '取消', style: 'cancel' },
              { 
                text: '重新登入', 
                onPress: () => {
                  AsyncStorage.removeItem('user_id');
                  AsyncStorage.removeItem('user_phone');
                  AsyncStorage.removeItem('user_email');
                  AsyncStorage.removeItem('user_full_name');
                  AsyncStorage.removeItem('user_id_number');
                  AsyncStorage.removeItem('user_birthdate');
                  AsyncStorage.removeItem('user_mrn');
                  router.replace('/');
                }
              }
            ]
          );
          setProfileLoading(false);
          return;
        }

        // === 設定基本資料到狀態 ===
        setUserProfile(basicProfile);
        setProfileLoading(false);

        // === 檢查是否需要從伺服器更新完整資料 ===
        const needsUpdate = !fullName || !idNumber || !birthdate;
        
        if (needsUpdate) {
          let url = '';
          if (userId) {
            url = `${API_URL}/api/user/profile?id=${userId}`;
          } else if (phone) {
            url = `${API_URL}/api/user/profile?phone=${phone}`;
          } else if (email) {
            url = `${API_URL}/api/user/profile?email=${email}`;
          }

          if (url) {
            const res = await authFetch(url);
            const data = await res.json();
            
            if (data && data.user) {
              const profile = data.user;
              
              // 更新 setItemAsync 和狀態
              await AsyncStorage.setItem('user_full_name', profile.full_name || '');
              await AsyncStorage.setItem('user_id_number', profile.id_number || '');
              await AsyncStorage.setItem('user_birthdate', profile.birthdate || '');
              await AsyncStorage.setItem('user_mrn', profile.mrn || '');
              await AsyncStorage.setItem('user_address', profile.address || '');
              await AsyncStorage.setItem('user_emergency_name', profile.emergency_name || '');
              await AsyncStorage.setItem('user_emergency_phone', profile.emergency_phone || '');
              
              setUserProfile(profile);

              // 檢查必填欄位
              const requiredFields = ['birthdate', 'id_number', 'address', 'emergency_name', 'emergency_phone'];
              const missing = requiredFields.filter(f => !profile[f]);
              if (missing.length > 0) {
                Alert.alert('提醒', '請至右上角完成資料填寫');
              }
            }
          }
        }
      } catch (error) {
        console.error('初始化個人資料時發生錯誤:', error);
        Alert.alert('錯誤', '無法取得個人資料，請稍後再試');
        setProfileLoading(false);
      }
    };

    initUserProfile();

    // 取得公告資料
    fetch(`${API_URL}/api/announcements`)
      .then(res => {
        if (!res.ok) throw new Error('無法取得健康資訊');
        return res.json();
      })
      .then(data => {
        setHealthInfo(data.data || data);
        setLoading(false);
      })
      .catch(err => {
        setError('健康資訊載入失敗');
        setLoading(false);
      });
  }, []);

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
              
              console.log('[Patient] 用戶已登出，清除所有本地資料');
              
              // 導向登入頁面
              router.replace('/');
            } catch (error) {
              console.error('[Patient] 登出時發生錯誤:', error);
              Alert.alert('錯誤', '登出失敗，請稍後再試');
            }
          }
        }
      ]
    );
  };

  // 取得歡迎訊息
  const getWelcomeMessage = () => {
    if (profileLoading) return '載入中...';
    if (!userProfile) return '歡迎使用';
    
    const name = userProfile.full_name || userProfile.phone || userProfile.email || '使用者';
    const hour = new Date().getHours();
    let timeGreeting = '';
    
    if (hour < 12) timeGreeting = '早安';
    else if (hour < 18) timeGreeting = '午安';
    else timeGreeting = '晚安';
    
    return `${timeGreeting}，${name}`;
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.wrapper}>
        {/* 個人設定按鈕 */}
        <TouchableOpacity
          style={styles.avatarBtn}
          onPress={() => router.push('/user/profile')}
        >
          <FontAwesome name="cog" size={48} color="#333" />
          <Text style={styles.avatarText}>設定</Text>
        </TouchableOpacity>

        {/* 登出按鈕 */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>登出</Text>
        </TouchableOpacity>

        <View style={styles.container}>
          {/* === 歡迎訊息區域 === */}
          <Text style={styles.welcomeText}>{getWelcomeMessage()}</Text>
          
          {/* === 公告資訊區域 === */}
          <Text style={styles.header}>公告</Text>
          
          {/* 公告內容可滾動區塊 */}
          <View style={styles.announcementBox}>
            <ScrollView>
              {loading ? (
                <Text style={styles.description}>載入中...</Text>
              ) : error ? (
                <Text style={[styles.description, { color: 'red' }]}>{error}</Text>
              ) : healthInfo && Array.isArray(healthInfo) && healthInfo.length > 0 ? (
                healthInfo.map((item: any) => (
                  <View key={item.id} style={{ marginBottom: 16 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 18 }}>{item.title}</Text>
                    <Text style={{ color: '#444', marginTop: 4 }}>{item.content}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.description}>目前無健康資訊</Text>
              )}
            </ScrollView>
          </View>

          {/* === 功能選單網格 === */}
          {/* 提供各種醫療服務的快捷入口 */}
          <View style={styles.grid}>
            {/* 醫院掛號服務 */}
            <MenuButton 
              icon="calendar" 
              label="掛號" 
              route="/user/Hospital-registration" 
              router={router}
            />
            
            {/* 掛號查詢服務 */}
            <MenuButton 
              icon="search" 
              label="掛號查詢" 
              route="/user/Hospital-register-search" 
              router={router} 
            />
            
            {/* AI 堵塞檢測服務 */}
            <MenuButton 
              icon="heartbeat" 
              label="堵塞偵測" 
              route="/user/AI-check" 
              router={router} 
            />
            <MenuButton 
              icon="comment" 
              label="醫患對話" 
              route="/user/chat" 
              router={router} 
            />
            <MenuButton 
              icon="file-text" 
              label="病例" 
              route="/user/medical-record" 
              router={router} 
            />
            <MenuButton 
              icon="info-circle" 
              label="健康資訊" 
              route="/user/health-info" 
              router={router} 
            />
          </View>
        </View>
      </View>
    </>
  );
};

type RouteType =
  | "/user/Hospital-registration"
  | "/user/Hospital-register-search"
  | "/user/AI-check"
  | "/user/chat"
  | "/user/medical-record"
  | "/user/health-info"
  | "/user/profile";

type MenuButtonProps = {
  icon: string;
  label: string;
  route: RouteType;
  router: any;
};

const MenuButton = ({ icon, label, route, router }: MenuButtonProps) => (
  <TouchableOpacity
    style={styles.menuButton}
    onPress={() => {
      router.push(route);
    }}
  >
    <FontAwesome name={icon as any} size={24} color="#333" />
    <Text style={styles.menuLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  avatarBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    alignItems: 'center'
  },
  avatarText: {
    marginTop: 4,
    fontSize: 12,
    color: '#333'
  },
  logoutBtn: {
    position: 'absolute',
    top: 40,
    left: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ff4444'
  },
  logoutText: {
    fontSize: 14,
    color: '#ff4444',
    fontWeight: 'bold',
    textDecorationLine: 'underline'
  },
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 100
  },
  // 新增歡迎訊息樣式
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333'
  },
  // 新增個人資料卡片樣式
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
  },
  profileDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10
  },
  // 調整公告樣式
  announcementBox: {
    height: 100,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  menuButton: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  },
  menuLabel: {
    marginTop: 12,
    fontSize: 16,
    color: '#333'
  }
});

export default HealthInfo;
