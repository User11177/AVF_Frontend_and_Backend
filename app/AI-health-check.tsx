import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';

export default function HealthCheckScreen() {
  const router = useRouter();

  const recordAudio = async () => {
    // TODO: 呼叫後端錄製聲音的 API
    Alert.alert('錄製聲音', '這裡會連接錄音 API');
  };

  const recordVibration = async () => {
    // TODO: 呼叫後端錄製震動的 API
    Alert.alert('錄製震動', '這裡會連接震動 API');
  };

  const uploadData = () => {
    // TODO: 上傳資料後跳轉頁面
    router.push('./health-check-result');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>堵塞率偵測</Text>
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.uploadBox} onPress={recordAudio}>
          <FontAwesome name="plus" size={32} color="#333" />
          <Text style={styles.label}>錄製聲音</Text>
          <Text style={styles.subLabel}>上傳數據</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.uploadBox} onPress={recordVibration}>
          <FontAwesome name="plus" size={32} color="#333" />
          <Text style={styles.label}>錄製震動</Text>
          <Text style={styles.subLabel}>上傳數據</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.uploadButton} onPress={uploadData}>
        <Text style={styles.uploadText}>上傳</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
    alignItems: 'center'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
    marginTop: 60
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20
  },
  uploadBox: {
    width: 120,
    height: 120,
    backgroundColor: '#eee',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
    padding: 10
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 10
  },
  subLabel: {
    fontSize: 12,
    color: '#555'
  },
  uploadButton: {
    marginTop: 50,
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: '#222'
  },
  uploadText: {
    fontSize: 16,
    fontWeight: 'bold'
  }
});
