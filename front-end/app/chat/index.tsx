// chat/index.tsx
// 客服式聊天室列表 - 病患看自己的諮詢，醫師看所有病患諮詢

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { authFetch } from '../../utils/authFetch';
import { API_URL } from '../../utils/appgol_config';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ChatRoom {
  id: number;
  patient_id: number;
  title: string;
  status: 'active' | 'closed';
  patient_name: string;
  patient_phone?: string;
  patient_mrn?: string;
  unread_count: number;
  last_message?: string;
  last_message_time?: string;
  last_sender_role?: 'patient' | 'doctor';
  created_at: string;
  updated_at: string;
}

export default function ChatListPage() {
  const router = useRouter();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState<string>('');

  // 載入聊天室列表
  const loadChatRooms = async () => {
    try {
      // 從後端獲取用戶角色
      const userResponse = await authFetch(`${API_URL}/api/user/current-role`);
      const userData = await userResponse.json();
      const role = userData.role;
      setUserRole(role || '');

      console.log('[Chat] 用戶角色:', role);

      // 如果是病患，先嘗試創建或取得聊天室
      if (role === 'patient') {
        console.log('[Chat] 病患用戶，嘗試創建或取得聊天室');
        
        try {
          const createResponse = await authFetch(`${API_URL}/api/chat/create-or-get`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          const createData = await createResponse.json();
          console.log('[Chat] 創建聊天室結果:', createData);
          
          if (createData.success && createData.chat_room) {
            // 直接設置聊天室到列表中
            setChatRooms([createData.chat_room]);
            setLoading(false);
            setRefreshing(false);
            return;
          }
        } catch (createError) {
          console.error('[Chat] 創建聊天室錯誤:', createError);
          // 如果創建失敗，繼續嘗試載入列表
        }
      }

      const response = await authFetch(`${API_URL}/api/chat/rooms`);
      const data = await response.json();

      console.log('[Chat] 聊天室列表響應:', data);

      if (Array.isArray(data)) {
        setChatRooms(data);
      } else {
        console.error('[Chat] 意外的響應格式:', data);
        Alert.alert('錯誤', '無法載入聊天室列表');
      }
    } catch (error) {
      console.error('[Chat] 載入聊天室列表錯誤:', error);
      Alert.alert('錯誤', '網路連線失敗');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 格式化時間
  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    
    const date = new Date(timeString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('zh-TW', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffDays === 1) {
      return '昨天';
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return date.toLocaleDateString('zh-TW', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  // 進入聊天室
  const handleEnterChat = (room: ChatRoom) => {
    router.push({
      pathname: '/chat/room',
      params: { 
        chatRoomId: room.id,
        patientName: room.patient_name,
        patientId: room.patient_id
      }
    });
  };

  // 創建新聊天室（病患專用）
  const handleCreateChat = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/chat/create-or-get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      if (data.success) {
        // 刷新列表
        loadChatRooms();
        
        // 直接進入聊天室
        router.push({
          pathname: '/chat/room',
          params: { 
            chatRoomId: data.chat_room.id,
            patientName: data.chat_room.patient_name,
            patientId: data.chat_room.patient_id
          }
        });
      } else {
        Alert.alert('錯誤', '無法創建聊天室');
      }
    } catch (error) {
      Alert.alert('錯誤', '創建聊天室失敗');
      console.error('創建聊天室錯誤:', error);
    }
  };

  // 渲染聊天室項目
  const renderChatRoom = ({ item }: { item: ChatRoom }) => (
    <TouchableOpacity
      style={styles.chatRoomCard}
      onPress={() => handleEnterChat(item)}
    >
      {/* 病患資訊區 */}
      <View style={styles.avatarContainer}>
        <View style={[
          styles.avatar,
          { backgroundColor: userRole === 'doctor' ? '#4CAF50' : '#2196F3' }
        ]}>
          <Text style={styles.avatarText}>
            {userRole === 'doctor' ? item.patient_name?.[0] || 'P' : '醫'}
          </Text>
        </View>
        {item.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>
              {item.unread_count > 99 ? '99+' : item.unread_count}
            </Text>
          </View>
        )}
      </View>

      {/* 聊天室資訊 */}
      <View style={styles.chatInfo}>
        <View style={styles.titleRow}>
          <Text style={styles.chatTitle}>
            {userRole === 'doctor' ? 
              `${item.patient_name}的諮詢` : 
              '醫療諮詢'
            }
          </Text>
          <Text style={styles.timeText}>
            {formatTime(item.last_message_time)}
          </Text>
        </View>
        
        {userRole === 'doctor' && (
          <Text style={styles.patientInfo}>
            {item.patient_mrn && `病歷號: ${item.patient_mrn}`}
            {item.patient_phone && ` | ${item.patient_phone}`}
          </Text>
        )}
        
        {item.last_message && (
          <View style={styles.lastMessageRow}>
            {item.last_sender_role && (
              <Text style={[
                styles.senderLabel,
                item.last_sender_role === 'doctor' ? styles.doctorLabel : styles.patientLabel
              ]}>
                {item.last_sender_role === 'doctor' ? '醫師' : '病患'}:
              </Text>
            )}
            <Text 
              style={[
                styles.lastMessage,
                item.unread_count > 0 && styles.unreadMessage
              ]} 
              numberOfLines={1}
            >
              {item.last_message}
            </Text>
          </View>
        )}
      </View>

      {/* 狀態指示 */}
      <View style={styles.statusContainer}>
        {item.status === 'active' && (
          <View style={styles.activeStatus}>
            <Text style={styles.activeStatusText}>●</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  // 下拉刷新
  const onRefresh = () => {
    setRefreshing(true);
    loadChatRooms();
  };

  useEffect(() => {
    loadChatRooms();
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
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: userRole === 'doctor' ? '病患諮詢' : '醫療諮詢',
          headerStyle: { backgroundColor: '#2196F3' },
          headerTintColor: '#fff',
          headerRight: () => (
            userRole === 'patient' && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleCreateChat}
              >
                <Text style={styles.addButtonText}>+</Text>
              </TouchableOpacity>
            )
          )
        }} 
      />
      
      {chatRooms.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {userRole === 'doctor' ? '暫無病患諮詢' : '尚未開始諮詢'}
          </Text>
          <Text style={styles.emptySubtext}>
            {userRole === 'doctor' ? 
              '等待病患提出醫療問題' : 
              '開始您的醫療諮詢'
            }
          </Text>
          {userRole === 'patient' && (
            <TouchableOpacity 
              style={styles.createChatButton}
              onPress={handleCreateChat}
            >
              <Text style={styles.createChatButtonText}>開始醫療諮詢</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={chatRooms}
          renderItem={renderChatRoom}
          keyExtractor={(item) => item.id.toString()}
          style={styles.chatList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  chatList: {
    flex: 1,
  },
  chatRoomCard: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  unreadBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#f44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  chatInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  timeText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  patientInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  lastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  senderLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginRight: 4,
  },
  doctorLabel: {
    color: '#4CAF50',
  },
  patientLabel: {
    color: '#2196F3',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  unreadMessage: {
    color: '#333',
    fontWeight: '500',
  },
  statusContainer: {
    marginLeft: 8,
  },
  activeStatus: {
    width: 8,
    height: 8,
  },
  activeStatusText: {
    color: '#4CAF50',
    fontSize: 12,
  },
  addButton: {
    marginRight: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#2196F3',
    fontSize: 20,
    fontWeight: '600',
  },
  createChatButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  createChatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});