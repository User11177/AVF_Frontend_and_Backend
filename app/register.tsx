// app/register.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  const handleRegister = () => {
    if (!name || !idNumber || !phone || !email || !password || !confirmPwd) {
      Alert.alert('錯誤', '請填寫所有欄位');
      return;
    }
    if (password !== confirmPwd) {
      Alert.alert('錯誤', '密碼與確認密碼不一致');
      return;
    }
    // TODO: 換成你自己的註冊 API 呼叫
    Alert.alert('註冊成功！');
    router.replace('/');  // 註冊完跳到登入頁
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>註冊</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>姓名</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="輸入姓名"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>身分證字號</Text>
        <TextInput
          style={styles.input}
          value={idNumber}
          onChangeText={setIdNumber}
          placeholder="輸入身分證字號"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>電話</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="輸入電話"
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.com"
          keyboardType="email-address"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>密碼</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="輸入密碼"
          secureTextEntry
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>再輸入一次密碼</Text>
        <TextInput
          style={styles.input}
          value={confirmPwd}
          onChangeText={setConfirmPwd}
          placeholder="再次輸入密碼"
          secureTextEntry
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>註冊</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    marginBottom: 5,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 5,
    paddingHorizontal: 10,
  },
  button: {
    backgroundColor: '#888',
    paddingVertical: 12,
    borderRadius: 5,
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
});
