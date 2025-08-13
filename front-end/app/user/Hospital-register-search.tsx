import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RegisterSearchWebPage() {
  const [loading, setLoading] = useState(true);
  const [idNumber, setIdNumber] = useState('');
  const [birthdate, setBirthdate] = useState('');

  useEffect(() => {
    // 從 AsyncStorage 取得 id_number, birthdate
    AsyncStorage.getItem('user_id_number').then(val => setIdNumber(val || ''));
    AsyncStorage.getItem('user_birthdate').then(val => setBirthdate(val || ''));
  }, []);

  // 轉換 birthdate 成 7碼民國生日格式
  const getBirthday7 = (birthdate: string) => {
    if (!birthdate) return '';
    // 假設 birthdate 格式為 YYYY-MM-DD
    const [y, m, d] = birthdate.split('-');
    const rocYear = (parseInt(y, 10) - 1911).toString().padStart(3, '0');
    return `${rocYear}${m}${d}`;
  };

  const injectedJS = `
    (function() {
      var idInput = document.querySelector('input[name="UserId"]');
      var birthInput = document.querySelector('input[name="Birthday"]');
      if(idInput) idInput.value = "${idNumber}";
      if(birthInput) birthInput.value = "${getBirthday7(birthdate)}";
    })();
    true;
  `;

  return (
    <View style={{ flex: 1 }}>
      <WebView
        source={{ uri: 'https://webreg.edah.org.tw/Register/QueryAndCancel#' }}
        style={{ flex: 1 }}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        injectedJavaScript={injectedJS}
      />
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#965ee4" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
});
