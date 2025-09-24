// ============================================================================
// medical-records.tsx - 檢測記錄查看頁面
// ============================================================================
// 
// 主要功能：
// 1. 顯示用戶的歷史檢測記錄
// 2. 包含檢測時間、檢測方式、檢測結果等資訊
// 3. 支援記錄篩選和排序功能
// 4. 提供詳細的檢測資訊查看
// 
// 頁面佈局：
// - 頂部：篩選和排序選項
// - 中央：檢測記錄列表（卡片式顯示）
// - 每個記錄包含：時間、方式、結果、詳情按鈕
// ============================================================================

import React, { useEffect, useState } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, 
  ScrollView, Alert, RefreshControl 
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { API_URL } from '../../utils/appgol_config';
import { authFetch } from '../../utils/authFetch';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// 檢測記錄類型定義
// ============================================================================
interface MeasurementRecord {
  measurement_id: number;
  position: number;
  mode: 'audio' | 'vib' | 'both';
  duration_sec: number;
  captured_at: string;
  created_at: string;
  analysis_id?: number;
  analysis?: 'audio' | 'vib' | 'fusion';
  result?: 'good' | 'bad';
  details?: string;
  analyzed_at?: string;
}

// ============================================================================
// 主組件：MedicalRecords - 檢測記錄查看頁面
// ============================================================================
const MedicalRecords = () => {
  const router = useRouter();
  
  // ============================================================================
  // 狀態管理
  // ============================================================================
  const [records, setRecords] = useState<MeasurementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'audio' | 'vib' | 'both'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // 預設最新在前

  // ============================================================================
  // 載入檢測記錄
  // ============================================================================
  const loadMedicalRecords = async () => {
    try {
      setError(null);
      
      // 檢查用戶登入狀態
      const userId = await AsyncStorage.getItem('user_id');
      if (!userId) {
        Alert.alert('錯誤', '請重新登入');
        router.replace('/');
        return;
      }

      // 從後端API獲取檢測記錄（使用病患專用端點）
      const response = await authFetch(`${API_URL}/api/patient/my-records`);
      const data = await response.json();
      
      if (data.success && data.measurements) {
        setRecords(data.measurements);
      } else {
        setRecords([]);
      }
      
    } catch (err: any) {
      console.error('載入檢測記錄失敗:', err);
      setError('載入檢測記錄失敗，請稍後再試');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ============================================================================
  // 初始化載入
  // ============================================================================
  useEffect(() => {
    loadMedicalRecords();
  }, []);

  // ============================================================================
  // 下拉刷新處理
  // ============================================================================
  const onRefresh = () => {
    setRefreshing(true);
    loadMedicalRecords();
  };

  // ============================================================================
  // 記錄篩選和排序
  // ============================================================================
  const getFilteredAndSortedRecords = () => {
    let filtered = records;
    
    // 篩選檢測方式
    if (filterMode !== 'all') {
      filtered = filtered.filter(record => record.mode === filterMode);
    }
    
    // 排序
    filtered.sort((a, b) => {
      const dateA = new Date(a.captured_at || a.created_at);
      const dateB = new Date(b.captured_at || b.created_at);
      
      if (sortOrder === 'desc') {
        return dateB.getTime() - dateA.getTime();
      } else {
        return dateA.getTime() - dateB.getTime();
      }
    });
    
    return filtered;
  };

  // ============================================================================
  // 格式化日期時間
  // ============================================================================
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('zh-TW'),
      time: date.toLocaleTimeString('zh-TW', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };
  };

  // ============================================================================
  // 取得檢測方式顯示文字
  // ============================================================================
  const getModeText = (mode: string) => {
    switch (mode) {
      case 'audio': return '音頻檢測';
      case 'vib': return '震動檢測';
      case 'both': return '音頻+震動';
      default: return mode;
    }
  };

  // ============================================================================
  // 取得檢測位置顯示文字
  // ============================================================================
  const getPositionText = (position: number) => {
    switch (position) {
      case 1: return '位置 1';
      case 2: return '位置 2';
      case 3: return '位置 3';
      default: return `位置 ${position}`;
    }
  };

  // ============================================================================
  // 取得檢測結果顯示樣式
  // ============================================================================
  const getResultStyle = (result?: string) => {
    switch (result) {
      case 'good':
        return { color: '#4CAF50', text: '正常' };
      case 'bad':
        return { color: '#F44336', text: '異常' };
      default:
        return { color: '#9E9E9E', text: '分析中' };
    }
  };

  // ============================================================================
  // 查看檢測詳情
  // ============================================================================
  const viewRecordDetails = (record: MeasurementRecord) => {
    const resultStyle = getResultStyle(record.result);
    const dateTime = formatDateTime(record.captured_at || record.created_at);
    
    Alert.alert(
      '檢測詳情',
      `檢測時間：${dateTime.date} ${dateTime.time}\n` +
      `檢測方式：${getModeText(record.mode)}\n` +
      `檢測位置：${getPositionText(record.position)}\n` +
      `檢測時長：${record.duration_sec || 0} 秒\n` +
      `分析結果：${resultStyle.text}\n` +
      `詳細說明：${record.details || '無額外說明'}`,
      [
        { text: '關閉', style: 'cancel' }
      ]
    );
  };

  // ============================================================================
  // 組件渲染
  // ============================================================================
  return (
    <>
      <Stack.Screen 
        options={{ 
          title: '檢測記錄',
          headerStyle: {
            backgroundColor: '#2196F3',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          }
        }} 
      />
      
      <View style={styles.container}>
        
        {/* ============================================================================
         * 篩選和排序控制區域
         * ============================================================================ */}
        <View style={styles.controlsContainer}>
          {/* 檢測方式篩選 */}
          <View style={styles.filterContainer}>
            <Text style={styles.controlLabel}>篩選方式：</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[
                { key: 'all', label: '全部' },
                { key: 'audio', label: '音頻' },
                { key: 'vib', label: '震動' },
                { key: 'both', label: '混合' }
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.filterButton,
                    filterMode === option.key && styles.filterButtonActive
                  ]}
                  onPress={() => setFilterMode(option.key as any)}
                >
                  <Text style={[
                    styles.filterButtonText,
                    filterMode === option.key && styles.filterButtonTextActive
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          {/* 排序控制 */}
          <View style={styles.sortContainer}>
            <Text style={styles.controlLabel}>排序：</Text>
            <TouchableOpacity
              style={styles.sortButton}
              onPress={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            >
              <FontAwesome 
                name={sortOrder === 'desc' ? 'sort-amount-desc' : 'sort-amount-asc'} 
                size={16} 
                color="#2196F3" 
              />
              <Text style={styles.sortButtonText}>
                {sortOrder === 'desc' ? '最新優先' : '最舊優先'}
              </Text>
            </TouchableOpacity>
          </View>
          
        </View>

        {/* ============================================================================
         * 檢測記錄列表
         * ============================================================================ */}
        <ScrollView
          style={styles.scrollContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {loading ? (
            /* 載入狀態 */
            <View style={styles.centerContainer}>
              <Text style={styles.loadingText}>載入中...</Text>
            </View>
          ) : error ? (
            /* 錯誤狀態 */
            <View style={styles.centerContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => {
                  setLoading(true);
                  loadMedicalRecords();
                }}
              >
                <Text style={styles.retryButtonText}>重新載入</Text>
              </TouchableOpacity>
            </View>
          ) : getFilteredAndSortedRecords().length === 0 ? (
            /* 無記錄狀態 */
            <View style={styles.centerContainer}>
              <FontAwesome name="clipboard" size={48} color="#ccc" />
              <Text style={styles.emptyText}>尚無檢測記錄</Text>
              <Text style={styles.emptySubText}>
                {filterMode !== 'all' ? '請嘗試其他篩選條件' : '開始您的第一次檢測吧！'}
              </Text>
            </View>
          ) : (
            /* 記錄列表 */
            getFilteredAndSortedRecords().map((record, index) => {
              const dateTime = formatDateTime(record.captured_at || record.created_at);
              const resultStyle = getResultStyle(record.result);
              
              return (
                <TouchableOpacity
                  key={`${record.measurement_id}-${index}`}
                  style={styles.recordCard}
                  onPress={() => viewRecordDetails(record)}
                >
                  {/* 記錄頭部：時間和結果 */}
                  <View style={styles.recordHeader}>
                    <View style={styles.dateTimeContainer}>
                      <Text style={styles.dateText}>{dateTime.date}</Text>
                      <Text style={styles.timeText}>{dateTime.time}</Text>
                    </View>
                    <View style={[styles.resultBadge, { backgroundColor: resultStyle.color }]}>
                      <Text style={styles.resultText}>{resultStyle.text}</Text>
                    </View>
                  </View>
                  
                  {/* 記錄詳情 */}
                  <View style={styles.recordDetails}>
                    <View style={styles.detailRow}>
                      <FontAwesome name="microphone" size={14} color="#666" />
                      <Text style={styles.detailText}>{getModeText(record.mode)}</Text>
                    </View>
                    
                    <View style={styles.detailRow}>
                      <FontAwesome name="map-marker" size={14} color="#666" />
                      <Text style={styles.detailText}>{getPositionText(record.position)}</Text>
                    </View>
                    
                    <View style={styles.detailRow}>
                      <FontAwesome name="clock-o" size={14} color="#666" />
                      <Text style={styles.detailText}>{record.duration_sec || 0} 秒</Text>
                    </View>
                  </View>
                  
                  {/* 查看詳情指示器 */}
                  <View style={styles.recordFooter}>
                    <Text style={styles.viewDetailsText}>點擊查看詳情</Text>
                    <FontAwesome name="chevron-right" size={12} color="#ccc" />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>
    </>
  );
};

// ============================================================================
// 樣式定義
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  
  // 控制區域樣式
  controlsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  
  filterContainer: {
    marginBottom: 12
  },
  
  controlLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
  },
  
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd'
  },
  
  filterButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3'
  },
  
  filterButtonText: {
    fontSize: 14,
    color: '#666'
  },
  
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold'
  },
  
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f0f0'
  },
  
  sortButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#2196F3'
  },
  
  // 記錄列表樣式
  scrollContainer: {
    flex: 1,
    padding: 16
  },
  
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40
  },
  
  loadingText: {
    fontSize: 16,
    color: '#666'
  },
  
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 16
  },
  
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#2196F3',
    borderRadius: 6
  },
  
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
    marginBottom: 8
  },
  
  emptySubText: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center'
  },
  
  // 記錄卡片樣式
  recordCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  
  dateTimeContainer: {
    flex: 1
  },
  
  dateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333'
  },
  
  timeText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2
  },
  
  resultBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12
  },
  
  resultText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff'
  },
  
  recordDetails: {
    marginBottom: 12
  },
  
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  
  detailText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666'
  },
  
  recordFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0'
  },
  
  viewDetailsText: {
    fontSize: 12,
    color: '#ccc'
  }
});

export default MedicalRecords;
