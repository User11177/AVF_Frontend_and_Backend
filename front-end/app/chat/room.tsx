// chat/room.tsx
// 客服式聊天室對話頁面

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { authFetch } from '../../utils/authFetch';
import { API_URL } from '../../utils/appgol_config';
import AsyncStorage from '@react-native-async-storage/async-storage';


interface ChatMessage {
  id: number;
  chat_room_id: number;
  sender_id: number;
  sender_role: 'patient' | 'doctor';
  sender_name: string;
  sender_user_role: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export default function ChatRoomPage() {
  const router = useRouter();
  const { chatRoomId, patientName, patientId } = useLocalSearchParams();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [userId, setUserId] = useState<number>(0);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  


  // 載入聊天訊息
  const loadMessages = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/chat/messages/${chatRoomId}`);
      const data = await response.json();

      if (data.success && Array.isArray(data.messages)) {
        setMessages(data.messages);
        
        // 滾動到底部
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      Alert.alert('錯誤', '無法載入聊天記錄');
      console.error('載入聊天記錄錯誤:', error);
    } finally {
      setLoading(false);
    }
  };



  // 發送訊息
  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;

    setSending(true);
    
    try {
      console.log('[ChatRoom] 發送訊息，聊天室ID:', chatRoomId, '內容:', inputText.trim());
      
      const response = await authFetch(`${API_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_room_id: parseInt(chatRoomId as string),
          content: inputText.trim()
        })
      });

      console.log('[ChatRoom] 發送訊息響應狀態:', response.status);
      const data = await response.json();
      console.log('[ChatRoom] 發送訊息響應:', data);
      
      if (data.success) {
        setInputText('');
        // 添加新訊息到列表
        setMessages(prev => [...prev, data.message]);
        
        // 滾動到底部
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        console.error('[ChatRoom] 訊息發送失敗:', data);
        Alert.alert('錯誤', data.error || data.detail || '訊息發送失敗');
      }
    } catch (error) {
      console.error('[ChatRoom] 發送訊息錯誤:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('錯誤', `網路連線失敗: ${errorMessage}`);
    } finally {
      setSending(false);
    }
  };

  // 建立 WebSocket 連接
  const setupWebSocket = async () => {
    if (!userId) return;

    try {
      // 取得 JWT token
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        console.error('[WebSocket] 缺少 JWT token');
        Alert.alert('錯誤', '請重新登入');
        return;
      }

      // 處理 ngrok HTTPS -> WSS 的轉換，並加入 JWT token
      const wsUrl = `${API_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/ws/chat/${userId}?token=${encodeURIComponent(token)}`;
      console.log('[WebSocket] 嘗試連接到:', wsUrl);
      const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket 連接成功');
      setWsConnection(ws);
      
      // 加入聊天室
      ws.send(JSON.stringify({
        type: 'join_room',
        room_id: parseInt(chatRoomId as string)
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new_message' && data.chat_room_id === parseInt(chatRoomId as string)) {
          const newMessage = data.message;
          
          // 收到新訊息，添加到列表
          setMessages(prev => [...prev, newMessage]);
          
          // 滾動到底部
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      } catch (error) {
        console.log('WebSocket 訊息解析錯誤:', error);
      }
    };

    ws.onerror = (error) => {
      console.log('WebSocket 錯誤:', error);
    };

          ws.onclose = () => {
        console.log('WebSocket 連接關閉');
        setWsConnection(null);
        
        // 嘗試重新連接
        setTimeout(() => {
          setupWebSocket();
        }, 3000);
      };
    } catch (error) {
      console.error('[WebSocket] 連接建立失敗:', error);
      Alert.alert('錯誤', 'WebSocket 連接失敗，請稍後再試');
    }
  };

  // 格式化時間
  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('zh-TW', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // 渲染訊息
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMyMessage = item.sender_role === userRole;
    const isDoctor = item.sender_role === 'doctor';
    
    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
      ]}>
        {/* 顯示發送者名稱（如果不是自己的訊息） */}
        {!isMyMessage && (
          <Text style={[
            styles.senderName,
            isDoctor ? styles.doctorName : styles.patientName
          ]}>
            {isDoctor ? `醫師 ${item.sender_name || ''}` : `病患 ${item.sender_name || ''}`}
          </Text>
        )}
        
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
          isDoctor && !isMyMessage ? styles.doctorMessageBubble : {}
        ]}>
          <Text style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.otherMessageText
          ]}>
            {item.content || ''}
          </Text>
          
          <Text style={[
            styles.messageTime,
            isMyMessage ? styles.myMessageTime : styles.otherMessageTime
          ]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  useEffect(() => {
    const initChat = async () => {
      // 從後端獲取用戶資訊
      try {
        const userResponse = await authFetch(`${API_URL}/api/user/current-role`);
        const userData = await userResponse.json();
        const id = await AsyncStorage.getItem('user_id');
        
        setUserRole(userData.role || '');
        setUserId(parseInt(id || '0'));
        

        
        // 載入訊息
        await loadMessages();
      } catch (error) {
        console.error('[ChatRoom] 獲取用戶信息失敗:', error);
        Alert.alert('錯誤', '無法獲取用戶信息');
      }
    };

    initChat();
    

  }, [chatRoomId]);

  useEffect(() => {
    if (userId > 0) {
      setupWebSocket();
    }

    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, [userId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>載入對話中...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen 
        options={{ 
          title: userRole === 'doctor' ? `${patientName || '病患'}的諮詢` : '醫療諮詢',
          headerStyle: { backgroundColor: '#2196F3' },
          headerTintColor: '#fff'
        }} 
      />
      
      {/* 連接狀態指示 */}
      {!wsConnection && (
        <View style={styles.connectionBanner}>
          <Text style={styles.connectionText}>正在重新連接...</Text>
        </View>
      )}
      
      {/* 訊息列表 */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }}
      />
      
      {/* 輸入區域 */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder={userRole === 'doctor' ? "回覆病患問題..." : "向醫師提問..."}
          multiline
          maxLength={1000}
          editable={!sending}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!inputText.trim() || sending) && styles.sendButtonDisabled
          ]}
          onPress={sendMessage}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>發送</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  connectionBanner: {
    backgroundColor: '#FF9800',
    paddingVertical: 8,
    alignItems: 'center',
  },
  connectionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    paddingVertical: 8,
  },
  messageContainer: {
    marginVertical: 2,
    marginHorizontal: 12,
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    marginHorizontal: 8,
  },
  doctorName: {
    color: '#4CAF50',
  },
  patientName: {
    color: '#2196F3',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  myMessageBubble: {
    backgroundColor: '#2196F3',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  doctorMessageBubble: {
    backgroundColor: '#e8f5e8',
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 4,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 11,
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: '#e3f2fd',
  },
  otherMessageTime: {
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#2196F3',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});