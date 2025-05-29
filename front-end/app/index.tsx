import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { API_URL } from './appgol_config';
export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

 
 



  const handleSignIn = async () => {
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }) // ✅ 傳 username
      });

      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      if (!res.ok) {
        const msg = json?.detail || text;
        return Alert.alert('登入失敗', msg);
      }

      if (json && json.role) {
        console.log('登入成功，用戶 ID:', json.user_id, '角色:', json.role);
        switch (json.role) {
          case 'doctor':
            router.push('/doctor/doctor');
            break;
          case 'patient':
            router.push('/user/patient');
            break;
          case 'admin':
            router.push('/admin/bot');
            break;
          default:
            Alert.alert('錯誤', '無效的用戶角色');
        }
      } else {
        console.warn('登入成功，但回傳格式異常');
        Alert.alert('登入成功，但回傳格式異常');
      }
    } catch (err) {
      console.error('登入錯誤', err);
      Alert.alert('錯誤', '無法連線到伺服器');
    }
  };

  const handleForgotPassword = () => {
    router.push('/user/forgot-password');
  };

  const handleSignUp = () => {
    router.push('/user/register');
  };

  return (
    <>
          {/* ✅ 新增：隱藏標題列 */}
          <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.container}>
          <View style={styles.logoContainer}>
            <TouchableOpacity onPress={() => router.push('/user/aidetect')}>
              <Image
                source={{
                  uri: 'https://images.seeklogo.com/logo-png/46/1/chatgpt-logo-png_seeklogo-465219.png',
                }}
                style={styles.logo}
              />
            </TouchableOpacity>
          </View>


      <Text style={styles.title}>登入</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>帳號</Text>
        <TextInput
          style={styles.input}
          placeholder="請輸入帳號"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>密碼</Text>
        <TextInput
          style={styles.input}
          placeholder="********"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      </View>

      <TouchableOpacity style={styles.signInButton} onPress={handleSignIn}>
        <Text style={styles.signInButtonText}>Sign In</Text>
      </TouchableOpacity>

      <View style={styles.linkContainer}>
        <TouchableOpacity onPress={handleForgotPassword}>
          <Text style={styles.linkText}>忘記密碼</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSignUp}>
          <Text style={styles.linkText}>註冊</Text>
        </TouchableOpacity>
      </View>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    padding: 16,
    justifyContent: 'center'
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ccc'
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 24
  },
  inputContainer: {
    marginBottom: 16
  },
  label: {
    marginBottom: 8,
    fontSize: 14
  },
  input: {
    height: 40,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 8
  },
  signInButton: {
    backgroundColor: '#777',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center'
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16
  },
  linkText: {
    color: '#0000EE',
    textDecorationLine: 'underline'
  }
});
