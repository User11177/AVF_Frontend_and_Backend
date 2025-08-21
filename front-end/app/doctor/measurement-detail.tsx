// measurement-detail.tsx
// 檢測詳情頁面 - 顯示單一檢測的詳細資料和分析結果

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { authFetch } from '../../utils/authFetch';
import { API_URL } from '../../utils/appgol_config';

interface MeasurementDetail {
  id: number;
  user_id: number;
  mrn: string;
  position: number;
  mode: string;
  audio_path?: string;
  audio_size?: number;
  vib_path?: string;
  vib_size?: number;
  duration_sec: number;
  captured_at: string;
  created_at: string;
  patient_name: string;
  analysis?: string;
  result?: 'good' | 'bad';
  details?: string;
  analyzed_at?: string;
}

export default function MeasurementDetailPage() {
  const router = useRouter();
  const { measurementId, patientName } = useLocalSearchParams();
  
  const [measurement, setMeasurement] = useState<MeasurementDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // 載入檢測詳情
  const loadMeasurementDetail = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/doctor/measurement/${measurementId}`);
      const data = await response.json();

      if (data.success) {
        setMeasurement(data.data);
      } else {
        Alert.alert('錯誤', '無法載入檢測詳情');
      }
    } catch (error) {
      Alert.alert('錯誤', '網路連線失敗');
      console.error('載入檢測詳情錯誤:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeasurementDetail();
  }, [measurementId]);

  // 格式化日期
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-TW');
  };

  // 格式化文件大小
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // 取得檢測位置文字
  const getPositionText = (position: number) => {
    const positions = { 1: '位置1', 2: '位置2', 3: '位置3' };
    return positions[position as keyof typeof positions] || `位置${position}`;
  };

  // 取得檢測模式文字
  const getModeText = (mode: string) => {
    const modes = {
      'audio': '音頻檢測',
      'vib': '振動檢測',
      'both': '音頻+振動檢測'
    };
    return modes[mode as keyof typeof modes] || mode;
  };

  // 取得分析類型文字
  const getAnalysisText = (analysis?: string) => {
    if (!analysis) return '未分析';
    const types = {
      'audio': '音頻分析',
      'vib': '振動分析',
      'fusion': '融合分析'
    };
    return types[analysis as keyof typeof types] || analysis;
  };

  // 開啟聊天室
  const handleOpenChat = async () => {
    if (!measurement) return;
    
    try {
      const response = await authFetch(`${API_URL}/api/chat/create-or-get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: measurement.user_id })
      });
      
      const data = await response.json();
      if (data.success) {
        router.push({
          pathname: '/chat/room',
          params: { 
            chatRoomId: data.chat_room.id, 
            partnerName: measurement.patient_name,
            partnerId: measurement.user_id
          }
        });
      }
    } catch (error) {
      Alert.alert('錯誤', '無法開啟聊天室');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>載入中...</Text>
      </View>
    );
  }

  if (!measurement) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>找不到檢測資料</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: `${patientName} - 檢測詳情`,
          headerStyle: { backgroundColor: '#2196F3' },
          headerTintColor: '#fff'
        }} 
      />
      
      <ScrollView style={styles.scrollView}>
        {/* 基本資訊 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本資訊</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.label}>病患姓名:</Text>
              <Text style={styles.value}>{measurement.patient_name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>病歷號:</Text>
              <Text style={styles.value}>{measurement.mrn}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>檢測位置:</Text>
              <Text style={styles.value}>{getPositionText(measurement.position)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>檢測模式:</Text>
              <Text style={styles.value}>{getModeText(measurement.mode)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>檢測時長:</Text>
              <Text style={styles.value}>{measurement.duration_sec} 秒</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>檢測時間:</Text>
              <Text style={styles.value}>{formatDateTime(measurement.captured_at)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>上傳時間:</Text>
              <Text style={styles.value}>{formatDateTime(measurement.created_at)}</Text>
            </View>
          </View>
        </View>

        {/* 檔案資訊 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>檔案資訊</Text>
          <View style={styles.infoCard}>
            {measurement.audio_path && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>音頻檔案:</Text>
                  <Text style={styles.value}>✓ 已上傳</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>檔案大小:</Text>
                  <Text style={styles.value}>{formatFileSize(measurement.audio_size)}</Text>
                </View>
              </>
            )}
            
            {measurement.vib_path && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>振動檔案:</Text>
                  <Text style={styles.value}>✓ 已上傳</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>檔案大小:</Text>
                  <Text style={styles.value}>{formatFileSize(measurement.vib_size)}</Text>
                </View>
              </>
            )}
            
            {!measurement.audio_path && !measurement.vib_path && (
              <View style={styles.noData}>
                <Text style={styles.noDataText}>無檔案資料</Text>
              </View>
            )}
          </View>
        </View>

        {/* AI 分析結果 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI 分析結果</Text>
          <View style={styles.infoCard}>
            {measurement.result ? (
              <>
                <View style={styles.resultHeader}>
                  <View style={[
                    styles.resultBadge,
                    measurement.result === 'good' ? styles.goodBadge : styles.badBadge
                  ]}>
                    <Text style={styles.resultText}>
                      {measurement.result === 'good' ? '正常' : '異常'}
                    </Text>
                  </View>
                  <Text style={styles.analysisType}>
                    {getAnalysisText(measurement.analysis)}
                  </Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.label}>分析時間:</Text>
                  <Text style={styles.value}>
                    {measurement.analyzed_at ? formatDateTime(measurement.analyzed_at) : '未知'}
                  </Text>
                </View>
                
                {measurement.details && (
                  <View style={styles.detailsContainer}>
                    <Text style={styles.detailsLabel}>詳細資訊:</Text>
                    <Text style={styles.detailsText}>{measurement.details}</Text>
                  </View>
                )}
                
                <View style={[
                  styles.resultSummary,
                  measurement.result === 'good' ? styles.goodSummary : styles.badSummary
                ]}>
                  <Text style={styles.summaryTitle}>
                    {measurement.result === 'good' ? '✓ 檢測結果正常' : '⚠️ 檢測發現異常'}
                  </Text>
                  <Text style={styles.summaryText}>
                    {measurement.result === 'good' 
                      ? '此次檢測未發現明顯異常，建議持續定期檢測。'
                      : '此次檢測發現異常，建議進一步檢查或諮詢醫師。'
                    }
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.noData}>
                <Text style={styles.noDataText}>尚未進行 AI 分析</Text>
                <Text style={styles.noDataSubtext}>
                  檔案正在處理中，請稍後查看分析結果
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 快速操作 */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.chatButton} onPress={handleOpenChat}>
            <Text style={styles.chatButtonText}>💬 與病患對話</Text>
          </TouchableOpacity>
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
    width: 100,
  },
  value: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  noData: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  goodBadge: {
    backgroundColor: '#4CAF50',
  },
  badBadge: {
    backgroundColor: '#f44336',
  },
  resultText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  analysisType: {
    fontSize: 14,
    color: '#666',
  },
  detailsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  detailsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  detailsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  resultSummary: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  goodSummary: {
    backgroundColor: '#f1f8e9',
    borderColor: '#4CAF50',
  },
  badSummary: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  chatButton: {
    backgroundColor: '#FF9800',
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
