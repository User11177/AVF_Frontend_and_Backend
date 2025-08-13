// app/_layout.tsx 或 app/layout.tsx

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authFetch } from '../utils/authFetch';
import { router } from 'expo-router';
import { useState } from 'react';
import { API_URL } from '../utils/appgol_config';

// 預防畫面資源還沒載入時 Splash 畫面被提早關閉
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });


  useEffect(() => {
    if (!loaded) {
      return;
    }
    SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) {
    return null; // 或 return <Loading />
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* 預設隱藏所有頁面標題列 */}
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
