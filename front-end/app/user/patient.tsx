import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router'; // ✅

const HealthInfo = () => {
  const router = useRouter();

  return (
        <>
      {/* 隱藏標題列 */}
      <Stack.Screen options={{ headerShown: false }} />
    <View style={styles.wrapper}>
      {/* 左上角的個人按鈕 */}
      <TouchableOpacity
        style={styles.avatarBtn}
        onPress={() => router.push('/user/profile')}
      >
        <FontAwesome name="user-circle" size={48} color="#333" />
        <Text style={styles.avatarText}>設定</Text>
      </TouchableOpacity>

      <View style={styles.container}>
        <Text style={styles.header}>健康資訊</Text>
        <Text style={styles.description}>在此處可以查看健康相關資訊與功能。</Text>
        <View style={styles.grid}>


          <MenuButton icon="calendar" label="掛號" route="/user/Hospital-registration" router={router}/>
          <MenuButton icon="search" label="掛號查詢" route="/user/Hospital-register-search" router={router} />
          <MenuButton icon="heartbeat" label="堵塞偵測" route="/user/AI-health-check" router={router} />
          <MenuButton icon="comment" label="醫患對話" route="/user/chat" router={router} />
          <MenuButton icon="file-text" label="病例" route="/user/medical-record" router={router} />
          <MenuButton icon="info-circle" label="健康資訊" route="/user/health-info" router={router} />
        </View>
      </View>
    </View>
    </>
  );
};

type RouteType =
  | "/Hospital-registration"
  | "/Hospital-register-search"
  | "/AI-health-check"
  | "/chat"
  | "/medical-record"
  | "/health-info"
  | "/profile";

  const MenuButton = ({
    icon,
    label,
    route,
    router,
  }: {
    icon: keyof typeof FontAwesome.glyphMap;
    label: string;
    route: string;
    router: ReturnType<typeof useRouter>;
  }) => {
    return (
      <TouchableOpacity style={styles.button} onPress={() => router.push(route as any)}>
        <FontAwesome name={icon} size={24} color="black" />
        <Text style={styles.buttonText}>{label}</Text>
      </TouchableOpacity>
    );
  };
const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  avatarBtn: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10,
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    color: '#333',
    marginTop: 2,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  description: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  button: {
    width: 120,
    height: 100,
    backgroundColor: '#D3D3D3',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 10,
    borderRadius: 10,
  },
  buttonText: {
    marginTop: 5,
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default HealthInfo;
