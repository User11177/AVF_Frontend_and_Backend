
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AdminSettings() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>管理員設定</Text>
      <Text style={styles.desc}>這是一個超簡單的設定頁面範例。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f7f7',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#222',
  },
  desc: {
    fontSize: 16,
    color: '#555',
  },
});
