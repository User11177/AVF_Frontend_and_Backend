import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet
} from 'react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = () => {
    // TODO: 在這裡加入登入邏輯，例如呼叫後端 API 進行驗證
    console.log('Email:', email);
    console.log('Password:', password);
  };

  const handleForgotPassword = () => {
    // TODO: 忘記密碼的流程，例如跳轉到忘記密碼頁面或彈出視窗
    console.log('忘記密碼');
  };

  const handleSignUp = () => {
    // TODO: 註冊的流程，例如跳轉到註冊頁面
    console.log('註冊');
  };

  return (
    <View style={styles.container}>
      {/* LOGO 區塊 */}
      <View style={styles.logoContainer}>
        <Image
          source={{ uri: 'https://via.placeholder.com/100?text=LOGO' }}
          style={styles.logo}
        />
      </View>

      {/* 標題或其他文字 */}
      <Text style={styles.title}>登入</Text>

      {/* Email 輸入框 */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="name@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
      </View>

      {/* Password 輸入框 */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="********"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      </View>

      {/* Sign In 按鈕 */}
      <TouchableOpacity style={styles.signInButton} onPress={handleSignIn}>
        <Text style={styles.signInButtonText}>Sign In</Text>
      </TouchableOpacity>

      {/* 忘記密碼、註冊 連結 */}
      <View style={styles.linkContainer}>
        <TouchableOpacity onPress={handleForgotPassword}>
          <Text style={styles.linkText}>忘記密碼</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSignUp}>
          <Text style={styles.linkText}>註冊</Text>
        </TouchableOpacity>
      </View>
    </View>
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
