  import React, { useRef, useState } from 'react';
  import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
  import { WebView } from 'react-native-webview';

  export default function HPAWebPage() {
    const [loading, setLoading] = useState(true);
    const webViewRef = useRef<WebView | null>(null);

    return (
      <View style={{ flex: 1 }}>
        <WebView
          ref={webViewRef}
          source={{ uri: 'https://www.hpa.gov.tw/Pages/List.aspx?nodeid=217' }}
          style={{ flex: 1 }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={({ nativeEvent }) => {
            setLoading(false);
            Alert.alert(
              '載入失敗',
              `無法載入頁面，請檢查網路連線或稍後再試。\n錯誤：${nativeEvent?.description ?? '未知錯誤'}`,
              [
                { text: '取消', style: 'cancel' },
                {
                  text: '重試',
                  onPress: () => {
                    setLoading(true);
                    webViewRef.current?.reload();
                  },
                },
              ]
            );
          }}
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
