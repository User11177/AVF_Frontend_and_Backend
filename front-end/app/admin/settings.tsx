import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Alert, ActivityIndicator, RefreshControl, Platform 
} from 'react-native';
import { Stack } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { authFetch } from '../../utils/authFetch';
import { API_URL } from '../../utils/appgol_config';

interface ErrorItem {
  error_code: string;
  count: number;
  last_occurred: string;
  description?: string;
}

interface LogsData {
  total_errors: number;
  top_errors: ErrorItem[];
  last_updated: string;
}

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logsData, setLogsData] = useState<LogsData | null>(null);
  const [exporting, setExporting] = useState(false);

  // ============================================================================
  // 載入錯誤日誌資料
  // ============================================================================
  const loadLogsData = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/error-logs`);
      const data = await res.json();
      
      if (data.success) {
        setLogsData(data.logs);
      } else {
        throw new Error(data.message || '載入失敗');
      }
    } catch (error) {
      console.error('載入錯誤日誌失敗:', error);
      Alert.alert('錯誤', '無法載入錯誤日誌資料');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ============================================================================
  // 匯出CSV功能
  // ============================================================================
  const exportCSV = async () => {
    if (!logsData?.top_errors?.length) {
      Alert.alert('提示', '沒有可匯出的資料');
      return;
    }

    Alert.alert(
      '匯出確認',
      '確定要匯出錯誤熱點資料為 CSV 格式嗎？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '匯出',
          onPress: async () => {
            setExporting(true);
            try {
              const res = await authFetch(`${API_URL}/api/admin/export-error-logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });

              const data = await res.json();
              if (data.success) {
                // 在實際實現中，這裡會處理檔案下載
                // 由於 React Native 限制，顯示下載連結或分享功能
                Alert.alert(
                  '匯出成功', 
                  `CSV 檔案已生成\n檔案名稱: ${data.filename}\n\n請聯繫系統管理員取得檔案`
                );
              } else {
                throw new Error(data.message || '匯出失敗');
              }
            } catch (error) {
              console.error('匯出失敗:', error);
              Alert.alert('錯誤', '匯出失敗，請稍後再試');
            } finally {
              setExporting(false);
            }
          }
        }
      ]
    );
  };

  // ============================================================================
  // 清除舊日誌
  // ============================================================================
  const clearOldLogs = async () => {
    Alert.alert(
      '清除確認',
      '確定要清除 7 天前的錯誤日誌嗎？此操作無法撤銷。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清除',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await authFetch(`${API_URL}/api/admin/clear-old-logs`, {
                method: 'POST'
              });

              const data = await res.json();
              if (data.success) {
                Alert.alert('成功', `已清除 ${data.deleted_count} 條舊日誌記錄`);
                loadLogsData(); // 重新載入資料
              } else {
                throw new Error(data.message || '清除失敗');
              }
            } catch (error) {
              console.error('清除日誌失敗:', error);
              Alert.alert('錯誤', '清除失敗，請稍後再試');
            }
          }
        }
      ]
    );
  };

  // ============================================================================
  // 重新整理
  // ============================================================================
  const onRefresh = () => {
    setRefreshing(true);
    loadLogsData();
  };

  // ============================================================================
  // 格式化時間
  // ============================================================================
  const formatTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      return date.toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return timeString;
    }
  };

  // ============================================================================
  // 獲取錯誤等級顏色
  // ============================================================================
  const getErrorLevelColor = (errorCode: string) => {
    if (errorCode.includes('500') || errorCode.includes('CRITICAL')) return '#f44336';
    if (errorCode.includes('404') || errorCode.includes('WARNING')) return '#ff9800';
    if (errorCode.includes('401') || errorCode.includes('403')) return '#e91e63';
    return '#2196F3';
  };

  // ============================================================================
  // 錯誤項目組件
  // ============================================================================
  const ErrorItem = ({ error }: { error: ErrorItem }) => (
    <View style={styles.errorItem}>
      <View style={styles.errorHeader}>
        <View style={[styles.errorBadge, { backgroundColor: getErrorLevelColor(error.error_code) }]}>
          <Text style={styles.errorCode}>{error.error_code}</Text>
        </View>
        <View style={styles.errorInfo}>
          <Text style={styles.errorCount}>次數: {error.count}</Text>
          <Text style={styles.errorTime}>
            最後發生: {formatTime(error.last_occurred)}
          </Text>
        </View>
      </View>
      {error.description && (
        <Text style={styles.errorDesc}>{error.description}</Text>
      )}
    </View>
  );

  // ============================================================================
  // 組件初始化
  // ============================================================================
  useEffect(() => {
    loadLogsData();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>載入中...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: '審核與日誌',
          headerStyle: { backgroundColor: '#2196F3' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' }
        }} 
      />
      
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ============================================================================
         * 統計概覽區域
         * ============================================================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 錯誤統計概覽</Text>
          
          {logsData ? (
            <View style={styles.statsOverview}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>24小時內總錯誤</Text>
                <Text style={styles.statValue}>{logsData.total_errors}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>錯誤類型數</Text>
                <Text style={styles.statValue}>{logsData.top_errors?.length || 0}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>最後更新</Text>
                <Text style={styles.statTimeValue}>
                  {formatTime(logsData.last_updated)}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.errorText}>無法載入統計資料</Text>
          )}
        </View>

        {/* ============================================================================
         * 錯誤熱點區域
         * ============================================================================ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🔥 錯誤熱點 (Top Errors)</Text>
            <TouchableOpacity 
              style={styles.exportButton}
              onPress={exportCSV}
              disabled={exporting || !logsData?.top_errors?.length}
            >
              <FontAwesome 
                name={exporting ? "spinner" : "download"} 
                size={14} 
                color="#fff" 
              />
              <Text style={styles.exportButtonText}>
                {exporting ? '匯出中...' : 'CSV匯出'}
              </Text>
            </TouchableOpacity>
          </View>

          {logsData?.top_errors?.length ? (
            <View style={styles.errorList}>
              {logsData.top_errors.map((error, index) => (
                <ErrorItem key={`${error.error_code}-${index}`} error={error} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <FontAwesome name="check-circle" size={48} color="#4CAF50" />
              <Text style={styles.emptyText}>太棒了！</Text>
              <Text style={styles.emptySubtext}>過去24小時內沒有錯誤記錄</Text>
            </View>
          )}
        </View>

        {/* ============================================================================
         * 管理操作區域
         * ============================================================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛠️ 日誌管理</Text>
          
          <View style={styles.actionContainer}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={onRefresh}
              disabled={refreshing}
            >
              <FontAwesome name="refresh" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>
                {refreshing ? '重新整理中...' : '重新整理'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.dangerButton]}
              onPress={clearOldLogs}
            >
              <FontAwesome name="trash" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>清除舊日誌</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.actionNote}>
            💡 提示：清除操作僅會移除7天前的日誌記錄，近期記錄將被保留用於分析。
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666'
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  
  // 統計概覽樣式
  statsOverview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3'
  },
  statTimeValue: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center'
  },
  
  // 匯出按鈕樣式
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600'
  },
  
  // 錯誤列表樣式
  errorList: {
    gap: 12
  },
  errorItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#e9ecef'
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  errorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 12
  },
  errorCode: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  errorInfo: {
    flex: 1,
    alignItems: 'flex-end'
  },
  errorCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2
  },
  errorTime: {
    fontSize: 12,
    color: '#666'
  },
  errorDesc: {
    marginTop: 8,
    fontSize: 14,
    color: '#555',
    lineHeight: 20
  },
  
  // 空狀態樣式
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 16,
    marginBottom: 8
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center'
  },
  
  // 操作區域樣式
  actionContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8
  },
  dangerButton: {
    backgroundColor: '#f44336'
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  actionNote: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    fontStyle: 'italic'
  },
  
  // 錯誤樣式
  errorText: {
    color: '#f44336',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic'
  }
});