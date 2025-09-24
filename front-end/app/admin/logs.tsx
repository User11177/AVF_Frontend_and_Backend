import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Alert, Switch, ActivityIndicator, RefreshControl 
} from 'react-native';
import { Stack } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { authFetch } from '../../utils/authFetch';
import { API_URL } from '../../utils/appgol_config';

interface HealthStatus {
  api: boolean;
  db: boolean;
  uploads_writable: boolean;
}

interface UserStats {
  admin_count: number;
  doctor_count: number;
  patient_count: number;
}

export default function AdminLogs() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  // ============================================================================
  // 載入系統狀態資料
  // ============================================================================
  const loadSystemStatus = async () => {
    try {
      // 並行載入所有資料
      const [healthRes, statsRes, maintenanceRes] = await Promise.all([
        authFetch(`${API_URL}/api/admin/health`),
        authFetch(`${API_URL}/api/admin/user-stats`),
        authFetch(`${API_URL}/api/admin/maintenance-status`)
      ]);

      const [healthData, statsData, maintenanceData] = await Promise.all([
        healthRes.json(),
        statsRes.json(),
        maintenanceRes.json()
      ]);

      if (healthData.success) setHealthStatus(healthData.health);
      if (statsData.success) setUserStats(statsData.stats);
      if (maintenanceData.success) setMaintenanceMode(maintenanceData.maintenance);
    } catch (error) {
      console.error('載入系統狀態失敗:', error);
      Alert.alert('錯誤', '無法載入系統狀態');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ============================================================================
  // 切換維護模式
  // ============================================================================
  const toggleMaintenanceMode = async (enabled: boolean) => {
    Alert.alert(
      '確認操作',
      `確定要${enabled ? '開啟' : '關閉'}維護模式嗎？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確定',
          style: 'destructive',
          onPress: async () => {
            setMaintenanceLoading(true);
            try {
              const res = await authFetch(`${API_URL}/api/admin/maintenance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maintenance: enabled })
              });

              const data = await res.json();
              if (data.success) {
                setMaintenanceMode(enabled);
                Alert.alert(
                  '操作成功',
                  `維護模式已${enabled ? '開啟' : '關閉'}`
                );
              } else {
                throw new Error(data.message || '操作失敗');
              }
            } catch (error) {
              console.error('切換維護模式失敗:', error);
              Alert.alert('錯誤', '操作失敗，請稍後再試');
            } finally {
              setMaintenanceLoading(false);
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
    loadSystemStatus();
  };

  // ============================================================================
  // 組件初始化
  // ============================================================================
  useEffect(() => {
    loadSystemStatus();
  }, []);

  // ============================================================================
  // 健康狀態燈號組件
  // ============================================================================
  const HealthIndicator = ({ label, status }: { label: string; status: boolean }) => (
    <View style={styles.healthItem}>
      <View style={[styles.statusLight, status ? styles.statusGreen : styles.statusRed]} />
      <Text style={styles.healthLabel}>{label}</Text>
      <Text style={[styles.healthStatus, { color: status ? '#4CAF50' : '#f44336' }]}>
        {status ? '正常' : '異常'}
      </Text>
    </View>
  );

  // ============================================================================
  // 統計卡片組件
  // ============================================================================
  const StatCard = ({ icon, label, count, color }: { 
    icon: string; label: string; count: number; color: string 
  }) => (
    <View style={styles.statCard}>
      <FontAwesome name={icon as any} size={24} color={color} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statCount, { color }]}>{count}</Text>
    </View>
  );

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
          title: '維護與日誌',
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
         * 維護模式控制區域
         * ============================================================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔧 維護模式</Text>
          <View style={styles.maintenanceControl}>
            <View style={styles.maintenanceInfo}>
              <Text style={styles.maintenanceLabel}>系統維護模式</Text>
              <Text style={styles.maintenanceDesc}>
                {maintenanceMode 
                  ? '已開啟 - 系統為唯讀模式，禁止寫入操作' 
                  : '已關閉 - 系統正常運行'
                }
              </Text>
            </View>
            <Switch
              value={maintenanceMode}
              onValueChange={toggleMaintenanceMode}
              disabled={maintenanceLoading}
              trackColor={{ false: '#ddd', true: '#2196F3' }}
              thumbColor={maintenanceMode ? '#fff' : '#f4f3f4'}
            />
          </View>
          
          {maintenanceMode && (
            <View style={styles.maintenanceWarning}>
              <FontAwesome name="warning" size={16} color="#ff9800" />
              <Text style={styles.warningText}>
                維護模式已啟用，所有用戶將看到維護公告
              </Text>
            </View>
          )}
        </View>

        {/* ============================================================================
         * 系統健康狀態區域
         * ============================================================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 系統健康檢查</Text>
          <View style={styles.healthContainer}>
            {healthStatus ? (
              <>
                <HealthIndicator label="API 服務" status={healthStatus.api} />
                <HealthIndicator label="資料庫連線" status={healthStatus.db} />
                <HealthIndicator label="檔案上傳" status={healthStatus.uploads_writable} />
              </>
            ) : (
              <Text style={styles.errorText}>無法載入健康狀態</Text>
            )}
          </View>
        </View>

        {/* ============================================================================
         * 用戶統計區域
         * ============================================================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 用戶統計</Text>
          <View style={styles.statsContainer}>
            {userStats ? (
              <>
                <StatCard 
                  icon="user-secret" 
                  label="管理員" 
                  count={userStats.admin_count} 
                  color="#e91e63" 
                />
                <StatCard 
                  icon="user-md" 
                  label="醫師" 
                  count={userStats.doctor_count} 
                  color="#2196F3" 
                />
                <StatCard 
                  icon="user" 
                  label="病患" 
                  count={userStats.patient_count} 
                  color="#4CAF50" 
                />
              </>
            ) : (
              <Text style={styles.errorText}>無法載入用戶統計</Text>
            )}
          </View>
        </View>

        {/* ============================================================================
         * 快速操作區域
         * ============================================================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ 快速操作</Text>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <FontAwesome name="refresh" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>
              {refreshing ? '重新整理中...' : '重新整理狀態'}
            </Text>
          </TouchableOpacity>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333'
  },
  
  // 維護模式樣式
  maintenanceControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  maintenanceInfo: {
    flex: 1,
    marginRight: 16
  },
  maintenanceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4
  },
  maintenanceDesc: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20
  },
  maintenanceWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800'
  },
  warningText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#856404',
    flex: 1
  },
  
  // 健康狀態樣式
  healthContainer: {
    gap: 12
  },
  healthItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8
  },
  statusLight: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12
  },
  statusGreen: {
    backgroundColor: '#4CAF50'
  },
  statusRed: {
    backgroundColor: '#f44336'
  },
  healthLabel: {
    flex: 1,
    fontSize: 16,
    color: '#333'
  },
  healthStatus: {
    fontSize: 14,
    fontWeight: '600'
  },
  
  // 統計卡片樣式
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef'
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    marginBottom: 4
  },
  statCount: {
    fontSize: 24,
    fontWeight: 'bold'
  },
  
  // 操作按鈕樣式
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  
  // 錯誤樣式
  errorText: {
    color: '#f44336',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic'
  }
});