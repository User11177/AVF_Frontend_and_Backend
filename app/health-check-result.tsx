import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function HealthCheckResultScreen() {
  const router = useRouter();

  const clogRate = 49; // 模擬從後端取得的堵塞率
  const suggestion =
    '建議多運動、減少油炸食物攝取，若症狀持續請諮詢醫師。';

  const goHome = () => {
    router.push('/home');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>堵塞率：</Text>
      <Text style={styles.percent}>{clogRate}%</Text>

      <Text style={styles.subtitle}>建議：</Text>
      <Text style={styles.suggestion}>{suggestion}</Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={goHome}>
          <Text style={[styles.buttonText, { color: '#d00' }]}>取消掛號</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.registerButton]} onPress={goHome}>
          <Text style={[styles.buttonText, { color: '#007AFF' }]}>掛號</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
    justifyContent: 'center'
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold'
  },
  percent: {
    fontSize: 48,
    fontWeight: 'bold',
    marginVertical: 16
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 24
  },
  suggestion: {
    fontSize: 16,
    marginTop: 8,
    color: '#333'
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 40
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    borderWidth: 1
  },
  cancelButton: {
    borderColor: '#d00'
  },
  registerButton: {
    borderColor: '#007AFF'
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold'
  }
});
