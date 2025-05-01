import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function Profile() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* 右上角關閉鈕 */}
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => router.back()}  // 返回上一頁
      >
        <FontAwesome name="close" size={24} color="#333" />
      </TouchableOpacity>

      {/* 頭像 */}
      <View style={styles.avatarWrapper}>
        <FontAwesome name="user-circle" size={80} color="#999" />
      </View>

      <Text style={styles.name}>[Name]</Text>
      <Text style={styles.subtitle}>[職稱或其他]</Text>

      {/* 資訊列表 */}
      <View style={styles.infoList}>
        <InfoRow icon="phone" label="電話：" value="09xxxxxxx" />
        <InfoRow icon="birthday-cake" label="出生：" value="1990xxxx" />
        <InfoRow icon="map-marker" label="地址：" value="xxxxxxx" />
        <InfoRow icon="envelope" label="MAIL：" value="xxxxxxxx@gmail.com" />
        <InfoRow icon="users" label="聯絡人：" value="xxx" />
        <InfoRow icon="bell" label="開啟提醒" />
      </View>
    </View>
  );
}

const InfoRow = ({
  icon,
  label,
  value,
}: {
  icon: keyof typeof FontAwesome.glyphMap;
  label: string;
  value?: string;
}) => (
  <View style={styles.row}>
    <FontAwesome name={icon} size={20} color="#333" style={{ width: 30 }} />
    <Text style={styles.rowLabel}>{label}</Text>
    {value && <Text style={styles.rowValue}>{value}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  closeBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
  },
  avatarWrapper: {
    marginTop: 80,
    alignItems: 'center',
    marginBottom: 20,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  infoList: {
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#DDD',
  },
  rowLabel: {
    flexShrink: 0,
    fontSize: 16,
    marginRight: 8,
  },
  rowValue: {
    fontSize: 16,
    color: '#333',
  },
});
