import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import React from 'react';
import { useRouter } from 'expo-router';

export default function DoctorHome() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>醫師首頁</Text>
      <TouchableOpacity style={styles.card} onPress={() => router.push('/user/chat')}>
        <Text style={styles.cardTitle}>1. 醫患對話</Text>
        <Text>與患者即時溝通、回覆訊息</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.card} onPress={() => router.push('/doctor/medical-record')}>
        <Text style={styles.cardTitle}>2. 患者病歷/堵塞結果查詢</Text>
        <Text>查詢患者歷史病歷與AI堵塞判斷結果</Text>
      </TouchableOpacity>
    </View>
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
});   