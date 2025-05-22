import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const API_URL = Platform.OS === 'android'
  ? 'http://10.0.2.2:8000'
  : 'http://localhost:8000';

export default function Profile() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const userId = 3; // TODO: 實作登入後自動帶入

  useEffect(() => {
    fetch(`${API_URL}/api/patient/${userId}`)
      .then(res => {
        if (!res.ok) throw new Error('取得失敗');
        return res.json();
      })
      .then(data => setProfile(data))
      .catch(err => {
        console.error("錯誤：", err);
        Alert.alert('錯誤', '無法載入資料');
      });
  }, []);

  const handleSave = () => {
    fetch(`${API_URL}/api/patient/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    })
      .then(res => {
        if (!res.ok) throw new Error('更新失敗');
        return res.json();
      })
      .then(() => {
        Alert.alert('成功', '資料已更新');
        setEditing(false);
      })
      .catch(err => {
        console.error("更新錯誤：", err);
        Alert.alert('錯誤', '更新失敗');
      });
  };

  if (!profile) return <Text style={{ padding: 20 }}>載入中...</Text>;

  return (
    <ScrollView style={styles.container}>
      
      <View style={styles.avatarWrapper}>
        <FontAwesome name="user-circle" size={80} color="#999" />
      </View>

      <Text style={styles.name}>{profile.full_name}</Text>
      <Text style={styles.subtitle}>{profile.username}</Text>

  <View style={styles.infoList}>
    <InfoField label="身分證" icon="id-card" value={profile.id_number} editable={editing}
      onChangeText={text => setProfile({ ...profile, id_number: text })} />
    <InfoField label="電話" icon="phone" value={profile.phone} editable={editing}
      onChangeText={text => setProfile({ ...profile, phone: text })} />
    <InfoField label="出生" icon="birthday-cake" value={profile.birthdate} editable={editing}
      onChangeText={text => setProfile({ ...profile, birthdate: text })} />
    <InfoField label="地址" icon="map-marker" value={profile.address} editable={editing}
      onChangeText={text => setProfile({ ...profile, address: text })} />
    <InfoField label="MAIL" icon="envelope" value={profile.email} editable={editing}
      onChangeText={text => setProfile({ ...profile, email: text })} />
    <InfoField label="聯絡人" icon="users" value={profile.emergency_name} editable={editing}
      onChangeText={text => setProfile({ ...profile, emergency_name: text })} />
    <InfoField label="聯絡人電話" icon="bell" value={profile.emergency_phone} editable={editing}
      onChangeText={text => setProfile({ ...profile, emergency_phone: text })} />
  </View>


      <TouchableOpacity style={styles.editBtn} onPress={() => (editing ? handleSave() : setEditing(true))}>
        <Text style={styles.editText}>{editing ? '完成' : '修改資訊'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

interface InfoFieldProps {
  icon: keyof typeof FontAwesome.glyphMap;
  label: string;
  value: string;
  editable: boolean;
  onChangeText: (text: string) => void;
}

const InfoField = ({ icon, label, value, editable, onChangeText }: InfoFieldProps) => (
  <View style={styles.row}>
    <FontAwesome name={icon} size={20} color="#333" style={{ width: 30 }} />
    <Text style={styles.rowLabel}>{label}：</Text>
    {editable ? (
      <TextInput style={styles.rowValueInput} value={value} onChangeText={onChangeText} />
    ) : (
      <Text style={styles.rowValue}>{value}</Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F5F5F5' },
  closeBtn: { position: 'absolute', top: 40, right: 20 },
  avatarWrapper: { marginTop: 80, alignItems: 'center', marginBottom: 20 },
  name: { fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: 20 },
  infoList: { marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#DDD' },
  rowLabel: { flexShrink: 0, fontSize: 16, marginRight: 8 },
  rowValue: { fontSize: 16, color: '#333' },
  rowValueInput: { fontSize: 16, color: '#333', flex: 1, borderBottomWidth: 1, borderColor: '#CCC' },
  editBtn: { marginTop: 30, backgroundColor: '#007AFF', padding: 12, borderRadius: 10, alignItems: 'center' },
  editText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
