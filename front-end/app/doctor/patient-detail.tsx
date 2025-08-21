// patient-detail.tsx
// 病患詳細資料和檢測記錄頁面

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { authFetch } from '../../utils/authFetch';
import { API_URL } from '../../utils/appgol_config';

interface Patient {
  id: number;
  full_name: string;
  id_number: string;
  email: string;
  phone: string;
  birthdate: string;
  address: string;
  emergency_name: string;
  emergency_phone: string;
  mrn: string;
  created_at: string;
}

interface Measurement {
  measurement_id: number;
  position: number;
  mode: string;
  duration_sec: number;
  captured_at: string;
  created_at: string;
  analysis_id?: number;
  analysis?: string;
  result?: 'good' | 'bad';
  details?: string;
  analyzed_at?: string;
}

export default function PatientDetailPage() {
  const router = useRouter();
  const { patientId, patientName } = useLocalSearchParams();
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 載入病患資料
  const loadPatientData = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/doctor/patient/${patientId}`);
      const data = await response.json();

      if (data.success) {
        setPatient(data.patient);
        setMeasurements(data.measurements);
      } else {
        Alert.alert('錯誤', '無法載入病患資料');
      }
    } catch (error) {
      Alert.alert('錯誤', '網路連線失敗');
      console.error('載入病患資料錯誤:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPatientData();
  }, [patientId]);

  // 下拉刷新
  const onRefresh = () => {
    setRefreshing(true);
    loadPatientData();
  };

  // 查看檢測詳情
  const handleViewMeasurement = (measurement: Measurement) => {
    router.push({
      pathname: '/doctor/measurement-detail',
      params: { 
        measurementId: measurement.measurement_id,
        patientName: patient?.full_name || ''
      }
    });
  };

  // 開啟病患的聊天室
  const handleOpenChat = async () => {
    try {
      console.log('[PatientDetail] 嘗試開啟聊天室，病患ID:', patientId);
      
      // 先嘗試創建或取得聊天室
      const createResponse = await authFetch(`${API_URL}/api/chat/create-or-get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: parseInt(patientId as string) })
      });
      
      const createData = await createResponse.json();
      console.log('[PatientDetail] 創建聊天室響應:', createData);
      
      if (createData.success) {
        router.push({
          pathname: '/chat/room',
          params: { 
            chatRoomId: createData.chat_room.id, 
            patientName: patient?.full_name || '',
            patientId: patientId
          }
        });
      } else {
        Alert.alert('錯誤', createData.error || '無法開啟聊天室');
      }
    } catch (error) {
      console.error('[PatientDetail] 開啟聊天室錯誤:', error);
      Alert.alert('錯誤', '無法開啟聊天室');
    }
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW') + ' ' + date.toLocaleTimeString('zh-TW', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // 取得檢測位置文字
  const getPositionText = (position: number) => {
    const positions = { 1: '位置1', 2: '位置2', 3: '位置3' };
    return positions[position as keyof typeof positions] || `位置${position}`;
  };

  // 取得檢測模式文字
  const getModeText = (mode: string) => {
    const modes = {
      'audio': '音頻',
      'vib': '振動',
      'both': '音頻+振動'
    };
    return modes[mode as keyof typeof modes] || mode;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>載入中...</Text>
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>找不到病患資料</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: patientName as string || '病患詳情',
          headerStyle: { backgroundColor: '#2196F3' },
          headerTintColor: '#fff'
        }} 
      />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 病患基本資料 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本資料</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.label}>姓名:</Text>
              <Text style={styles.value}>{patient.full_name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>身份證:</Text>
              <Text style={styles.value}>{patient.id_number}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>病歷號:</Text>
              <Text style={styles.value}>{patient.mrn}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>生日:</Text>
              <Text style={styles.value}>{patient.birthdate}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>電話:</Text>
              <Text style={styles.value}>{patient.phone}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Email:</Text>
              <Text style={styles.value}>{patient.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>地址:</Text>
              <Text style={styles.value}>{patient.address || '未填寫'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>緊急聯絡人:</Text>
              <Text style={styles.value}>
                {patient.emergency_name || '未填寫'} {patient.emergency_phone || ''}
              </Text>
            </View>
          </View>
        </View>

        {/* 快速操作 */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.chatButton} onPress={handleOpenChat}>
            <Text style={styles.chatButtonText}>💬 開啟對話</Text>
          </TouchableOpacity>
        </View>

        {/* 檢測記錄 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            檢測記錄 ({measurements.length} 筆)
          </Text>
          
          {measurements.length === 0 ? (
            <View style={styles.noData}>
              <Text style={styles.noDataText}>暫無檢測記錄</Text>
            </View>
          ) : (
            measurements.map((measurement) => (
              <TouchableOpacity
                key={measurement.measurement_id}
                style={styles.measurementCard}
                onPress={() => handleViewMeasurement(measurement)}
              >
                <View style={styles.measurementHeader}>
                  <Text style={styles.measurementDate}>
                    {formatDate(measurement.captured_at || measurement.created_at)}
                  </Text>
                  {measurement.result && (
                    <View style={[
                      styles.resultBadge,
                      measurement.result === 'good' ? styles.goodBadge : styles.badBadge
                    ]}>
                      <Text style={styles.resultText}>
                        {measurement.result === 'good' ? '正常' : '異常'}
                      </Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.measurementInfo}>
                  <Text style={styles.measurementText}>
                    {getPositionText(measurement.position)} • {getModeText(measurement.mode)}
                  </Text>
                  <Text style={styles.measurementText}>
                    時長: {measurement.duration_sec}秒
                  </Text>
                  {measurement.analysis && (
                    <Text style={styles.measurementText}>
                      分析: {measurement.analysis}
                    </Text>
                  )}
                </View>
                
                <Text style={styles.viewDetail}>點擊查看詳情 →</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: {
    fontSize: 14,
    color: '#666',
    width: 80,
  },
  value: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  chatButton: {
    backgroundColor: '#FF9800',
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noData: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
  },
  measurementCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  measurementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  measurementDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  resultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  goodBadge: {
    backgroundColor: '#4CAF50',
  },
  badBadge: {
    backgroundColor: '#f44336',
  },
  resultText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  measurementInfo: {
    marginBottom: 8,
  },
  measurementText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  viewDetail: {
    fontSize: 14,
    color: '#2196F3',
    textAlign: 'right',
  },
});
