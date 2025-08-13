import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { API_URL } from '../../utils/appgol_config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authFetch } from '../../utils/authFetch';

const HealthInfo = () => {
  const router = useRouter();
  const [healthInfo, setHealthInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 取得個人資料並檢查空值
    const checkProfile = async () => {
      try {
        const userId = await AsyncStorage.getItem('user_id');
        const phone = await AsyncStorage.getItem('user_phone');
        const email = await AsyncStorage.getItem('user_email');
        let url = '';
        if (userId) {
          url = `${API_URL}/api/user/profile?id=${userId}`;
        } else if (phone) {
          url = `${API_URL}/api/user/profile?phone=${phone}`;
        } else if (email) {
          url = `${API_URL}/api/user/profile?email=${email}`;
        } else {
          return;
        }
        const res = await authFetch(url);
        const data = await res.json();
        if (data && data.user) {
          const profile = data.user;
          const requiredFields = ['birthdate', 'id_number', 'address', 'emergency_name', 'emergency_phone'];
          const missing = requiredFields.filter(f => !profile[f]);
          if (missing.length > 0) {
            Alert.alert('提醒', '請至右上角完成資料填寫');
          }
        }
      } catch {}
    };
    checkProfile();

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

  return (
    <>
      {/* 隱藏標題列 */}
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

        <View style={styles.container}>
          <Text style={styles.header}>公告</Text>
          
          {/* 公告可滾動區塊 */}
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

          {/* 功能選單網格 */}
          <View style={styles.grid}>
            <MenuButton 
              icon="calendar" 
              label="掛號" 
              route="/user/Hospital-registration" 
              router={router}
            />
            <MenuButton 
              icon="search" 
              label="掛號查詢" 
              route="/user/Hospital-register-search" 
              router={router} 
            />
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
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 100
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10
  },
  // 新增公告專用樣式
  announcementBox: {
    height: 120,           // 可以自行調整高度
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
