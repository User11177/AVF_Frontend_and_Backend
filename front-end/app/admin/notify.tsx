import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, StyleSheet } from 'react-native';
import { API_URL } from '../../utils/appgol_config';
import { authFetch } from '../../utils/authFetch';

interface Announcement {
  id: number;
  title: string;
  content: string;
  published_at: string;
  publisher: string;
}

export default function AdminNotify() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  // 取得登入者 ID
  const getUserId = () => {
    try {
       
      if (typeof window !== 'undefined' && window.localStorage) {
        const id = window.localStorage.getItem('user_id');
        return id ? parseInt(id, 10) : 1;  
      }
    } catch {}
    return 1;
  };

  // 取得公告列表
  const fetchAnnouncements = () => {
    setLoading(true);
    authFetch(`${API_URL}/api/announcements`)
      .then(res => res.json())
      .then(data => setAnnouncements(data.data || []))
      .catch(() => Alert.alert('錯誤', '無法取得公告'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  // 新增公告
  const handleAdd = () => {
    if (!title.trim() || !content.trim()) return Alert.alert('請填寫標題與內容');
    authFetch(`${API_URL}/api/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, publisher_id: getUserId() }),
    })
      .then(res => res.json())
      .then(() => {
        setTitle('');
        setContent('');
        fetchAnnouncements();
      })
      .catch(() => Alert.alert('錯誤', '新增失敗'));
  };

  // 編輯公告
  const handleEdit = (item: Announcement) => {
    // 若已發布，不允許編輯
    if (item.published_at) {
      Alert.alert('提示', '已發布的公告不可編輯');
      return;
    }
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content);
  };

  const handleEditSave = () => {
    if (!editTitle.trim() || !editContent.trim()) return Alert.alert('請填寫標題與內容');
    authFetch(`${API_URL}/api/announcements/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle, content: editContent }),
    })
      .then(res => res.json())
      .then(() => {
        setEditingId(null);
        setEditTitle('');
        setEditContent('');
        fetchAnnouncements();
      })
      .catch(() => Alert.alert('錯誤', '更新失敗'));
  };

  // 刪除公告
  const handleDelete = (id: number) => {
    Alert.alert('確認', '確定要刪除這則公告嗎？', [
      { text: '取消' },
      {
        text: '刪除', style: 'destructive', onPress: () => {
          authFetch(`${API_URL}/api/announcements/${id}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(() => fetchAnnouncements())
            .catch(() => Alert.alert('錯誤', '刪除失敗'));
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>公告管理</Text>
      {/* 新增公告表單 */}
      <TextInput
        style={styles.input}
        placeholder="公告標題"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={[styles.input, { height: 80 }]}
        placeholder="公告內容"
        value={content}
        onChangeText={setContent}
        multiline
      />
      <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
        <Text style={styles.addBtnText}>發布公告</Text>
      </TouchableOpacity>

      {/* 公告列表 */}
      {loading ? <Text>載入中...</Text> : (
        <FlatList
          data={announcements}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.announcementBox}>
              {editingId === item.id ? (
                <>
                  <TextInput
                    style={styles.input}
                    value={editTitle}
                    onChangeText={setEditTitle}
                  />
                  <TextInput
                    style={[styles.input, { height: 80 }]}
                    value={editContent}
                    onChangeText={setEditContent}
                    multiline
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                    <TouchableOpacity onPress={handleEditSave} style={styles.saveBtn}>
                      <Text style={{ color: '#fff' }}>儲存</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingId(null)} style={styles.cancelBtn}>
                      <Text>取消</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.annTitle}>{item.title}</Text>
                  <Text style={styles.annContent}>{item.content}</Text>
                  <Text style={styles.annMeta}>發布者：{item.publisher}　時間：{item.published_at}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                    {/* 只有未發布公告才顯示編輯按鈕 */}
                    {!item.published_at && (
                      <TouchableOpacity onPress={() => handleEdit(item)} style={styles.editBtn}>
                        <Text style={{ color: '#fff' }}>編輯</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                      <Text style={{ color: '#fff' }}>刪除</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  input: { backgroundColor: '#fff', borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#ddd' },
  addBtn: { backgroundColor: '#007AFF', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 20 },
  addBtnText: { color: '#fff', fontSize: 16 },
  announcementBox: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#eee' },
  annTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  annContent: { fontSize: 15, color: '#333', marginBottom: 8 },
  annMeta: { fontSize: 12, color: '#888', marginBottom: 8 },
  editBtn: { backgroundColor: '#007AFF', borderRadius: 6, padding: 8, marginRight: 8 },
  deleteBtn: { backgroundColor: '#FF3B30', borderRadius: 6, padding: 8 },
  saveBtn: { backgroundColor: '#34C759', borderRadius: 6, padding: 8, marginRight: 8 },
  cancelBtn: { backgroundColor: '#eee', borderRadius: 6, padding: 8 },
});
