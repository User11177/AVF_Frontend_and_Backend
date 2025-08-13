import React, { useState, useRef } from 'react';
import { View, Text, Button, StyleSheet, Alert, Platform } from 'react-native';

import { Audio } from 'expo-av';

import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

const recordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: 2,
    audioEncoder: 3,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  },
  ios: {
    extension: '.caf',
    audioQuality: 2,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

export default function AudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startRecording = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('權限不足', '請允許錄音權限！');
      return;
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
    });
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(recordingOptions);
    await recording.startAsync();
    recordingRef.current = recording;
    setIsRecording(true);
    setFileUri(null);
  };

  const stopRecording = async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    let finalUri = uri ?? null;

    try {
      if (uri && FileSystem.documentDirectory) {
        const extension =
          Platform.OS === 'ios' ? '.caf' :
          Platform.OS === 'android' ? '.m4a' :
          '.webm';
        const targetUri = FileSystem.documentDirectory + '012345-2508101140-01' + extension;

        const info = await FileSystem.getInfoAsync(targetUri);
        if (info.exists) {
          await FileSystem.deleteAsync(targetUri, { idempotent: true });
        }

        await FileSystem.moveAsync({ from: uri, to: targetUri });
        finalUri = targetUri;
      }
    } catch (error) {
      console.warn('Failed to rename/move recording file:', error);
    }

    setFileUri(finalUri);
    setIsRecording(false);
    recordingRef.current = null;
  };

  const shareRecording = async () => {
    if (!fileUri) return;
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('無法分享', '本裝置不支援分享功能');
      return;
    }
    await Sharing.shareAsync(fileUri);
  };

  return (
    <View style={styles.container}>
      <Button
        title={isRecording ? "停止錄音" : "開始錄音"}
        onPress={isRecording ? stopRecording : startRecording}
      />
      <View style={{ height: 16 }} />
      <Button
        title="分享錄音檔"
        onPress={shareRecording}
        disabled={!fileUri}
      />
      <Text style={styles.text}>
        {fileUri
          ? `錄音檔案路徑:\n${fileUri}`
          : isRecording
          ? "錄音中..."
          : "尚未錄音"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  text: { marginTop: 30, textAlign: 'center', fontSize: 16, color: '#444' },
});


                            // 開始錄音