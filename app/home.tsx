import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const HealthInfo = () => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>健康資訊</Text>
      <Text style={styles.description}>在此處可以查看健康相關資訊與功能。</Text>
      <View style={styles.grid}>
        <MenuButton icon="calendar" label="掛號" route="/register" />
        <MenuButton icon="search" label="掛號查詢" route="/register-search" />
        <MenuButton icon="heartbeat" label="檢查偵測" route="/health-check" />
        <MenuButton icon="comment" label="醫患對話" route="/chat" />
        <MenuButton icon="file-text" label="病例" route="/medical-record" />
        <MenuButton icon="info-circle" label="健康資訊" route="/health-info" />
      </View>
    </View>
  );
};

// 限制 Route 只能是這些固定值
type RouteType =
  | "/register"
  | "/register-search"
  | "/health-check"
  | "/chat"
  | "/medical-record"
  | "/health-info";

const MenuButton = ({ icon, label, route }: { icon: keyof typeof FontAwesome.glyphMap; label: string; route: RouteType }) => {
  const router = useRouter();
  
  return (
    <TouchableOpacity style={styles.button} onPress={() => router.push('./login')}>
      <FontAwesome name={icon} size={24} color="black" />
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
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
