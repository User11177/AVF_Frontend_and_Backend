// app/_layout.tsx 或 app/layout.tsx

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState, useRef } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';

// ✅ 新增：NetInfo 監測
import NetInfo from '@react-native-community/netinfo';
import { View, Text, StyleSheet, Alert } from 'react-native';

// 預防畫面資源還沒載入時 Splash 畫面被提早關閉
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // ✅ 新增：全域網路狀態
  const [isOnline, setIsOnline] = useState(true);
  const alertShownRef = useRef(false);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 監聽網路狀態；同時考慮「連到 Wi-Fi 但無法上網」(isInternetReachable)
    const unsub = NetInfo.addEventListener((state) => {
      const reachable = state.isInternetReachable;
      const ok = (state.isConnected ?? false) && (reachable ?? true);
      setIsOnline(ok);
      
      // 網路中斷時彈出警告
      if (!ok && !alertShownRef.current) {
        alertShownRef.current = true;
        showOfflineAlert();
      } else if (ok) {
        // 網路恢復時重置標記和清理計時器
        alertShownRef.current = false;
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
      }
    });
    return () => unsub();
  }, []);

  // 顯示網路中斷警告
  const showOfflineAlert = () => {
    // 清理之前的計時器
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
    }

    Alert.alert(
      '網路連線中斷',
      '請檢查您的網路連線狀態',
      [
        {
          text: '確認',
          onPress: () => {
            // 檢查網路狀態，如果還是離線就再次彈出
            NetInfo.fetch().then((state) => {
              const reachable = state.isInternetReachable;
              const ok = (state.isConnected ?? false) && (reachable ?? true);
              if (!ok) {
                // 網路仍然中斷，重置標記並再次彈出警告
                alertShownRef.current = false;
                // 延遲一下再彈出，避免無限彈出
                retryTimerRef.current = setTimeout(() => {
                  showOfflineAlert();
                }, 1000); // 增加到2秒，給用戶更多時間
              }
            });
          }
        }
      ],
      { cancelable: false }
    );
  };

  useEffect(() => {
    if (!loaded) return;
    SplashScreen.hideAsync();
  }, [loaded]);

  // 清理計時器
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  if (!loaded) return null; // 或 return <Loading />

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* 預設隱藏所有頁面標題列 */}
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
