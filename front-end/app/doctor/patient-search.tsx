// patient-search.tsx
// 醫師搜尋病患頁面

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { authFetch } from '../../utils/authFetch';
import { API_URL } from '../../utils/appgol_config';

interface Patient {
  id: number;
  full_name: string;
  id_number: string;
  email: string;
  phone: string;
  birthdate: string;
  mrn: string;
  created_at: string;
}

export default function PatientSearchPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // 搜尋病患
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('提示', '請輸入搜尋關鍵字');
      return;
    }

    setLoading(true);
    console.log('[PatientSearch] 開始搜尋，關鍵字:', searchQuery);
    console.log('[PatientSearch] API URL:', API_URL);
    
    try {
      const url = `${API_URL}/api/doctor/search-patients?query=${encodeURIComponent(searchQuery)}`;
      console.log('[PatientSearch] 請求 URL:', url);
      
      const response = await authFetch(url);
      console.log('[PatientSearch] 響應狀態:', response.status);
      
      const data = await response.json();
      console.log('[PatientSearch] 響應資料:', data);

      if (data.success) {
        setPatients(data.data);
        setSearched(true);
        console.log('[PatientSearch] 搜尋成功，找到', data.data.length, '筆資料');
      } else {
        console.log('[PatientSearch] 搜尋失敗，錯誤:', data.message || '未知錯誤');
        Alert.alert('錯誤', data.message || '搜尋失敗');
      }
    } catch (error) {
      console.error('[PatientSearch] 搜尋病患錯誤:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('錯誤', `網路連線失敗: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // 查看病患詳情
  const handleViewPatient = (patient: Patient) => {
    router.push({
      pathname: '/doctor/patient-detail',
      params: { patientId: patient.id, patientName: patient.full_name }
    });
  };

  // 開啟聊天室
  const handleOpenChat = async (patient: Patient) => {
    try {
      console.log('[PatientSearch] 嘗試開啟聊天室，病患ID:', patient.id);
      
      const response = await authFetch(`${API_URL}/api/chat/create-or-get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patient.id })
      });
      
      const data = await response.json();
      console.log('[PatientSearch] 創建聊天室響應:', data);
      
      if (data.success) {
        router.push({
          pathname: '/chat/room',
          params: { 
            chatRoomId: data.chat_room.id, 
            patientName: patient.full_name,
            patientId: patient.id
          }
        });
      } else {
        Alert.alert('錯誤', data.error || '無法開啟聊天室');
      }
    } catch (error) {
      console.error('[PatientSearch] 開啟聊天室錯誤:', error);
      Alert.alert('錯誤', '無法開啟聊天室');
    }
  };

  // 渲染病患項目
  const renderPatient = ({ item }: { item: Patient }) => (
    <View style={styles.patientCard}>
      <View style={styles.patientHeader}>
        <Text style={styles.patientName}>{item.full_name}</Text>
        <Text style={styles.patientMrn}>MRN: {item.mrn}</Text>
      </View>
      
      <View style={styles.patientInfo}>
        <Text style={styles.infoText}>身份證: {item.id_number}</Text>
        <Text style={styles.infoText}>電話: {item.phone}</Text>
        <Text style={styles.infoText}>生日: {item.birthdate}</Text>
      </View>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.viewBtn]}
          onPress={() => handleViewPatient(item)}
        >
          <Text style={styles.viewBtnText}>查看病歷</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionBtn, styles.chatBtn]}
          onPress={() => handleOpenChat(item)}
        >
          <Text style={styles.chatBtnText}>開啟對話</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: '搜尋病患',
          headerStyle: { backgroundColor: '#2196F3' },
          headerTintColor: '#fff'
        }} 
      />
      
      {/* 搜尋區域 */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="輸入身份證、姓名或病歷號..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={handleSearch}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.searchBtnText}>搜尋</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 搜尋結果 */}
      {searched && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsHeader}>
            搜尋結果 ({patients.length} 筆)
          </Text>
          
          {patients.length === 0 ? (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>未找到符合的病患</Text>
            </View>
          ) : (
            <FlatList
              data={patients}
              renderItem={renderPatient}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 12,
    fontSize: 16,
  },
  searchBtn: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  searchBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
    padding: 16,
  },
  resultsHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  noResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
  },
  patientCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  patientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  patientName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  patientMrn: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  patientInfo: {
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  viewBtn: {
    backgroundColor: '#4CAF50',
  },
  chatBtn: {
    backgroundColor: '#FF9800',
  },
  viewBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  chatBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
