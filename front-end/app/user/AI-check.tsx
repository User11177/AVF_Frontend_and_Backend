/* 
  檔名：AICheck.tsx（推測）
  功能：三個固定位置的資料蒐集（音訊 m4a 與 WT901 震動 txt），並上傳到後端進行「可用性檢測 + 分析」。
  限制：僅加入註解，未更動任何一行邏輯或程式碼。
*/

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, Modal, ActivityIndicator, Linking, Platform, AppState, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { BleManager, Characteristic } from 'react-native-ble-plx';
import base64 from 'react-native-base64';
import { API_URL } from '../../utils/appgol_config';

/** 量測模式（只錄音、只震動、或兩者皆錄） */
type Mode = 'audio' | 'vib' | 'both';

/** 固定三個採樣點（1/2/3） */
type Pos = 1 | 2 | 3;

/** 每個位置的 UI 與檔案狀態 */
type PosState = { pos: Pos; status: 'idle'|'recording'|'done'; countdown: number; audioPath?: string; vibPath?: string; };

/** 錄製秒數（可在此調整） */
const RECORDING_DURATION = 10;

/** WT901 解析後的資料格式（僅示例，實際上只寫入 accX/accY/accZ） */
interface WT901Data {
  accX: number; accY: number; accZ: number;
  gyroX: number; gyroY: number; gyroZ: number;
  angleX: number; angleY: number; angleZ: number;
  mac: string;
  timestamp: number;
}

/** WT901 的 Service/Char UUID（常見的 FFE*） */
const serviceUUID = '0000ffe5-0000-1000-8000-00805f9a34fb';
const writeUUID   = '0000ffe9-0000-1000-8000-00805f9a34fb';
const notifyUUID  = '0000ffe4-0000-1000-8000-00805f9a34fb';

/**
 * 解析 WT901 的一個通知封包（此處以 0x61 標頭為例）
 * - 只在 buffer[1] === 0x61 才解析（對應加速度/角速度/角度的帧）
 * - getInt16：組合高低位元並處理有號整數
 * - 回傳各軸資料與裝置 MAC、時間戳
 */
function parseWT901Data(buffer: Uint8Array, mac: string): WT901Data | null {
  if (buffer[1] !== 0x61) return null;
  const getInt16 = (lo: number, hi: number) => { let v = (hi << 8) | lo; return v & 0x8000 ? v - 0x10000 : v; };
  return {
    accX: getInt16(buffer[2], buffer[3]) / 32768 * 16,
    accY: getInt16(buffer[4], buffer[5]) / 32768 * 16,
    accZ: getInt16(buffer[6], buffer[7]) / 32768 * 16,
    gyroX: getInt16(buffer[8], buffer[9]) / 32768 * 2000,
    gyroY: getInt16(buffer[10], buffer[11]) / 32768 * 2000,
    gyroZ: getInt16(buffer[12], buffer[13]) / 32768 * 2000,
    angleX: getInt16(buffer[14], buffer[15]) / 32768 * 180,
    angleY: getInt16(buffer[16], buffer[17]) / 32768 * 180,
    angleZ: getInt16(buffer[18], buffer[19]) / 32768 * 180,
    mac,
    timestamp: Date.now(),
  };
}

export default function AICheck() {
  /** 目前選擇的模式（audio/vib/both），null 表示尚未選擇 */
  const [mode, setMode] = useState<Mode | null>(null);
  /** 當開始量測後，鎖住模式避免誤觸切換 */
  const [isModeLocked, setIsModeLocked] = useState(false);
  /** 病歷號（MRN），從本機  取出，用於識別用戶 */
  const [mrn, setMrn] = useState<string>('');
  /** 三個固定位置的 UI 狀態列表，包含每個位置的錄製狀態和倒數計時 */
  const [list, setList] = useState<PosState[]>([
    { pos:1, status:'idle', countdown:0 },
    { pos:2, status:'idle', countdown:0 },
    { pos:3, status:'idle', countdown:0 },
  ]);
  /** 是否正在錄製，控制錄製過程中的 UI 顯示 */
  const [isRecording, setIsRecording] = useState(false);
  /** 全局倒數秒數，用於顯示在錄製過程中的倒數計時 */
  const [globalCountdown, setGlobalCountdown] = useState(0);
  /** 是否已完成權限檢查，避免在未檢查完權限時渲染主 UI */
  const [permissionsChecked, setPermissionsChecked] = useState(false);
  /** both 模式下的目前階段：先 audio（全部位置）→ 再 vib（全部位置），用於控制錄製流程 */
  const [bothModePhase, setBothModePhase] = useState<'audio' | 'vib' | null>(null);
  /** 權限狀態追蹤 */
  const [permissionStatus, setPermissionStatus] = useState<{
    audio: boolean,
    bluetooth: boolean,
    nearbyDevices: boolean,
    wt901Connected: boolean
  }>({audio: false, bluetooth: false, nearbyDevices: false, wt901Connected: false});
  
  /** 防止重複權限檢查的標記 */
  const isCheckingPermissions = useRef(false);
  
  /** 防止重複 BLE 連接的標記 */
  const isConnectingBle = useRef(false);
  
  /** 連接狀態管理 */
  const connectionStateRef = useRef<'disconnected' | 'connecting' | 'connected' | 'scanning'>('disconnected');

  /** expo-av 的 Recording 參考，用於控制錄音功能 */
  const recRef = useRef<Audio.Recording | null>(null);
  /** BLE 管理器與當前連線裝置/監聽 handle，用於管理藍牙連接和數據監聽 */
  const bleManagerRef = useRef(new BleManager());
  const bleDeviceRef = useRef<any>(null);
  const bleMonitorRef = useRef<any>(null);

  /** 收集中的震動資料（字串陣列，最終 join 成 CSV），用於存儲錄製的震動數據 */
  const vibDataRef = useRef<string[]>([]);
  
  /** 已移除自動重連機制，改為純手動控制 */
  
  /** 設備檢查面板是否展開 */
  const [isCheckPanelExpanded, setIsCheckPanelExpanded] = useState(false);

  /**
   * 初始化：讀 MRN、檢查權限（錄音/藍牙）
   * - 使用 useEffect 在組件掛載時執行，確保在組件初始化時進行必要的設置
   * - 獲取用戶的 MRN，若未設置則提示用戶設置
   * - 檢查錄音和藍牙的權限，確保應用有權限進行錄製和藍牙操作
   */
  useEffect(() => {
    (async () => {
      console.log('AI-check 頁面初始化開始');
      
      // 先清理所有 BLE 狀態
      await cleanupBleState();
      
      const m = await AsyncStorage.getItem('user_mrn');
      if (!m) Alert.alert('缺少病例號','請先於個人資料設定病例號(MRN)');
      setMrn(m || '');
      
      // 檢查權限（錄音 & 藍牙）
      await checkAllPermissions();
      
      // 不啟動自動重連，改為純手動控制
      console.log('WT901 連接設置為手動模式');
    })();
    
    // 清理函數
    return () => {
      if (bleMonitorRef.current) {
        bleMonitorRef.current.remove();
        bleMonitorRef.current = null;
      }
      // 停止掃描
      bleManagerRef.current.stopDeviceScan();
      
      // 斷開 WT901 連線
      if (bleDeviceRef.current) {
        bleDeviceRef.current.cancelConnection()
          .then(() => console.log('WT901 連線已斷開'))
          .catch((error: any) => console.log('斷開 WT901 連線失敗:', error));
        bleDeviceRef.current = null;
      }
    };
  }, []);

  /**
   * 監聽應用程式狀態變化，當從背景返回時重新檢查權限
   * - 處理用戶從設定頁面返回的情況
   * - 確保權限狀態始終是最新的
   */
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // 應用程式回到前台時，延遲重新檢查權限，避免過於頻繁
        setTimeout(() => {
          checkAllPermissions();
        }, 500);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => subscription?.remove();
  }, []);

  /**
   * 清理 BLE 連接狀態（同步狀態管理）
   * - 停止所有掃描
   * - 移除監聽器
   * - 斷開現有連接
   * - 重置所有狀態引用
   */
  async function cleanupBleState() {
    try {
      console.log('開始清理 BLE 狀態...');
      
      // 停止設備掃描
      try {
        bleManagerRef.current.stopDeviceScan();
      } catch (error) {
        console.log('停止掃描失敗:', error);
      }
      
      // 移除數據監聽器
      if (bleMonitorRef.current) {
        try {
          bleMonitorRef.current.remove();
        } catch (error) {
          console.log('移除監聽器失敗:', error);
        }
        bleMonitorRef.current = null;
      }
      
      // 斷開現有設備連接
      if (bleDeviceRef.current) {
        try {
          const isConnected = await Promise.race([
            bleDeviceRef.current.isConnected(),
            new Promise<boolean>((_, reject) => 
              setTimeout(() => reject(new Error('檢查超時')), 1000)
            )
          ]);
          
          if (isConnected) {
            await bleDeviceRef.current.cancelConnection();
            console.log('已斷開現有 WT901 連接');
          }
        } catch (error) {
          console.log('斷開連接時發生錯誤:', error);
        }
        bleDeviceRef.current = null;
      }
      
      // 重置所有狀態
      connectionStateRef.current = 'disconnected';
      setPermissionStatus(prev => ({ ...prev, wt901Connected: false }));
      
      console.log('BLE 狀態清理完成');
    } catch (error) {
      console.log('清理 BLE 狀態失敗:', error);
      // 即使清理失敗也要重置狀態
      connectionStateRef.current = 'disconnected';
      setPermissionStatus(prev => ({ ...prev, wt901Connected: false }));
    }
  }

  /**
   * 同步檢查所有權限與 WT901 連接狀態
   * - 檢查錄音權限
   * - 檢查藍牙權限
   * - 檢查附近裝置權限
   * - 檢查 WT901 是否已連接
   */
  async function checkAllPermissions() {
    // 防止重複檢查
    if (isCheckingPermissions.current) {
      console.log('權限檢查已進行中，跳過重複檢查');
      return;
    }
    
    isCheckingPermissions.current = true;
    
    try {
      console.log('開始檢查所有權限...');
      
      // 1. 檢查錄音權限
      const audioGranted = await checkAudioPermission();
      console.log('錄音權限:', audioGranted ? '已授權' : '未授權');
      
      // 2. 檢查藍牙狀態
      const bluetoothEnabled = await checkBluetoothStatus();
      console.log('藍牙狀態:', bluetoothEnabled ? '已開啟' : '未開啟');
      
      // 3. 檢查附近裝置權限
      const nearbyDevicesGranted = await checkNearbyDevicesPermission();
      console.log('附近裝置權限:', nearbyDevicesGranted ? '已授權' : '未授權');
      
      // 4. 檢查 WT901 連接狀態（僅檢查，不自動連接）
      const wt901Connected = await checkWT901Connection();
      console.log('WT901 連接:', wt901Connected ? '已連接' : '未連接');
      
      // 更新權限狀態
      setPermissionStatus({
        audio: audioGranted,
        bluetooth: bluetoothEnabled,
        nearbyDevices: nearbyDevicesGranted,
        wt901Connected: wt901Connected
      });
      
      // 顯示檢查結果
      const failedItems: string[] = [];
      if (!audioGranted) failedItems.push('錄音權限');
      if (!bluetoothEnabled) failedItems.push('藍牙');
      if (!nearbyDevicesGranted) failedItems.push('附近裝置權限');
      if (!wt901Connected) failedItems.push('WT901連接');
      
      if (failedItems.length > 0) {
        const title = '設備檢查';
        let message = '';
        let actionText = '前往設定';
        
        if (failedItems.includes('錄音權限')) {
          message += '• 需要開啟麥克風權限才能進行音訊錄製\n';
        }
        if (failedItems.includes('藍牙')) {
          message += '• 需要開啟藍牙才能連接震動感測器\n';
        }
        if (failedItems.includes('附近裝置權限')) {
          message += '• 需要附近裝置權限才能搜尋 WT901\n';
        }
        if (failedItems.includes('WT901連接')) {
          message += '• WT901 震動感測器尚未連接\n';
          actionText = '重新連接';
        }
        
        Alert.alert(
          title,
          message + '\n請檢查設備狀態或前往系統設定',
          [
            { text: '取消', style: 'cancel' },
            { text: actionText, onPress: () => failedItems.includes('WT901連接') ? connectWT901().catch(() => {}) : openAppSettings() }
          ]
        );
      } else {
        console.log('所有權限和設備檢查完成，狀態正常');
      }
      
      setPermissionsChecked(true);
    } catch (e) {
      console.warn('權限檢查失敗:', e);
      Alert.alert('權限檢查失敗', '無法完成權限檢查，請稍後再試');
      // 權限檢查失敗時，設置為不可用狀態
      setPermissionStatus({
        audio: false,
        bluetooth: false,
        nearbyDevices: false,
        wt901Connected: false
      });
      setPermissionsChecked(true);
    } finally {
      // 重置檢查標記
      isCheckingPermissions.current = false;
    }
  }

  /**
   * 檢查/請求錄音權限（使用 expo-av）
   * - 返回 Promise，表示是否授權，確保應用有權限進行錄音
   */
  async function checkAudioPermission(): Promise<boolean> {
    try {
      const { status } = await Audio.getPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * 檢查藍牙狀態
   */
  async function checkBluetoothStatus(): Promise<boolean> {
    try {
      const manager = bleManagerRef.current;
      const state = await manager.state();
      return state === 'PoweredOn';
    } catch (error) {
      console.log('檢查藍牙狀態失敗:', error);
      return false;
    }
  }

  /**
   * 檢查附近裝置權限
   */
  async function checkNearbyDevicesPermission(): Promise<boolean> {
    try {
      const manager = bleManagerRef.current;
      // 嘗試檢查權限狀態
      // 注意：react-native-ble-plx 沒有直接的權限檢查API
      // 這裡我們通過檢查藍牙狀態來推斷權限
      const state = await manager.state();
      return state === 'PoweredOn' || state === 'PoweredOff'; // 如果能取得狀態，表示有權限
    } catch (error) {
      console.log('檢查附近裝置權限失敗:', error);
      return false;
    }
  }

  /**
   * 檢查 WT901 設備是否已連線（與狀態管理同步）
   */
  async function checkWT901Connection(): Promise<boolean> {
    try {
      // 先檢查狀態管理
      if (connectionStateRef.current !== 'connected') {
        console.log(`WT901 狀態為 ${connectionStateRef.current}，非連接狀態`);
        setPermissionStatus(prev => ({ ...prev, wt901Connected: false }));
        return false;
      }
      
      // 檢查設備引用
      if (!bleDeviceRef.current) {
        console.log('WT901 設備引用不存在');
        connectionStateRef.current = 'disconnected';
        setPermissionStatus(prev => ({ ...prev, wt901Connected: false }));
        return false;
      }
      
      try {
        // 快速檢查連接狀態
        const isConnected = await Promise.race([
          bleDeviceRef.current.isConnected(),
          new Promise<boolean>((_, reject) => 
            setTimeout(() => reject(new Error('連接檢查超時')), 2000)
          )
        ]);
        
        if (!isConnected) {
          console.log('WT901 設備已斷線');
          connectionStateRef.current = 'disconnected';
          bleDeviceRef.current = null;
          setPermissionStatus(prev => ({ ...prev, wt901Connected: false }));
          return false;
        }
        
        // 連接正常
        setPermissionStatus(prev => ({ ...prev, wt901Connected: true }));
        return true;
        
      } catch (error) {
        console.log('檢查 WT901 連線狀態失敗:', error);
        connectionStateRef.current = 'disconnected';
        bleDeviceRef.current = null;
        setPermissionStatus(prev => ({ ...prev, wt901Connected: false }));
        return false;
      }
      
    } catch (error) {
      console.log('WT901 連接檢查失敗:', error);
      connectionStateRef.current = 'disconnected';
      setPermissionStatus(prev => ({ ...prev, wt901Connected: false }));
      return false;
    }
  }

  // 已移除自動重連機制，改為純手動控制

  /**
   * 開啟系統設定頁面
   * - iOS: 開啟應用程式的設定頁面
   * - Android: 開啟應用程式資訊頁面
   */
  async function openAppSettings() {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
      
      // 延遲一下再重新檢查權限，讓用戶有時間從設定頁面返回
      setTimeout(() => {
        checkAllPermissions();
      }, 1000);
      
    } catch (error) {
      console.warn('無法開啟設定頁面:', error);
    }
  }

  /**
   * 確保錄音可用：再次確認權限並設定 iOS 靜音錄製
   */
  async function ensureAudio() {
    try {
      const { status } = await Audio.getPermissionsAsync();
      if (status !== 'granted') { 
        // 權限被撤銷，更新狀態
        setPermissionStatus(prev => ({ ...prev, audio: false }));
        return false; 
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      return true;
    } catch (error) {
      console.log('錄音權限檢查失敗:', error);
      setPermissionStatus(prev => ({ ...prev, audio: false }));
      return false;
    }
  }

  /**
   * 掃描並連線 WT901（重新設計的穩定版本）
   * - 嚴格的狀態控制，防止多重連接
   * - 使用連接隊列避免競爭條件
   * - 改進的錯誤處理和清理機制
   */
  async function connectWT901() {
    console.log(`當前連接狀態: ${connectionStateRef.current}`);
    
    // 嚴格的狀態檢查：只允許在斷開狀態下開始連接
    if (connectionStateRef.current !== 'disconnected') {
      const message = `WT901 當前狀態為 ${connectionStateRef.current}，無法開始新的連接`;
      console.log(message);
      throw new Error(message);
    }
    
    // 設置為連接中狀態
    connectionStateRef.current = 'connecting';
    console.log('WT901 開始連接流程');
    
    try {
      // 檢查是否已有有效連接（雙重檢查）
      if (bleDeviceRef.current) {
        try {
          const isConnected = await Promise.race([
            bleDeviceRef.current.isConnected(),
            new Promise<boolean>((_, reject) => 
              setTimeout(() => reject(new Error('連接檢查超時')), 2000)
            )
          ]);
          
          if (isConnected) {
            console.log('WT901 已存在有效連接，無需重新連接');
            connectionStateRef.current = 'connected';
            setPermissionStatus(prev => ({ ...prev, wt901Connected: true }));
            return bleDeviceRef.current;
          }
        } catch (error) {
          console.log('檢查現有連接失敗，將清除引用:', error);
        }
        
        // 清除無效引用
        bleDeviceRef.current = null;
      }
      
      // 強制清理所有 BLE 狀態
      await cleanupBleState();
      
      // 等待 BLE 狀態完全穩定
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 開始掃描
      connectionStateRef.current = 'scanning';
      console.log('開始掃描 WT901 設備...');
      const manager = bleManagerRef.current;
      
      return new Promise((resolve, reject) => {
        let scanCompleted = false;
        
        const timeout = setTimeout(() => {
          if (!scanCompleted) {
            scanCompleted = true;
            connectionStateRef.current = 'disconnected';
            try {
              manager.stopDeviceScan();
            } catch (e) {
              console.log('停止掃描失敗:', e);
            }
            reject(new Error('掃描超時，請確認 WT901 設備已開啟並在附近'));
          }
        }, 10000); // 增加到10秒，給設備更多時間響應
        
        manager.startDeviceScan(null, null, async (err, device) => {
          // 防止重複處理
          if (scanCompleted) return;
          
          if (err) { 
            scanCompleted = true;
            clearTimeout(timeout); 
            connectionStateRef.current = 'disconnected';
            try {
              manager.stopDeviceScan();
            } catch (e) {
              console.log('停止掃描失敗:', e);
            }
            console.log('掃描失敗:', err);
            setPermissionStatus(prev => ({ ...prev, wt901Connected: false }));
            reject(err); 
            return; 
          }
          
          // 只在找到目標設備時記錄
          if (device && 
              (device.name === 'WTC2-B-B5' || 
               device.id?.toUpperCase() === 'DA:DC:BC:7A:88:77' ||
               device.id?.toUpperCase().includes('DA:DC:BC'))) {
            
            scanCompleted = true;
            clearTimeout(timeout);
            
            try {
              manager.stopDeviceScan();
              console.log('找到 WT901 設備，正在連接...', device.name || device.id);
              
              // 設置為連接中
              connectionStateRef.current = 'connecting';
              
              // 使用簡化的連接參數
              const connected = await manager.connectToDevice(device.id, {
                autoConnect: false,
                requestMTU: 256  // 降低 MTU 提高相容性
              });
              
              // 等待連接穩定
              await new Promise(resolve => setTimeout(resolve, 1500));
              
              // 發現服務
              await connected.discoverAllServicesAndCharacteristics();
              
              // 發送初始化命令（簡化版）
              try {
                await connected.writeCharacteristicWithResponseForService(
                  serviceUUID, 
                  writeUUID, 
                  base64.encode(String.fromCharCode(0xFF, 0xAA, 0x27))
                );
                console.log('WT901 初始化命令發送成功');
              } catch (writeError) {
                console.log('WT901 初始化命令發送失敗，但繼續連接:', writeError);
              }
              
              // 最終連接確認
              const finalCheck = await connected.isConnected();
              if (!finalCheck) {
                throw new Error('連接後立即斷開，設備不穩定');
              }
              
              // 設置斷線監聽器（簡化版）
              connected.onDisconnected((error, dev) => {
                console.log("WT901 已斷開:", dev?.id);
                if (error) console.log("斷線錯誤:", error);
                
                // 重置所有狀態
                connectionStateRef.current = 'disconnected';
                setPermissionStatus(prev => ({ ...prev, wt901Connected: false }));
                bleDeviceRef.current = null;
                
                // 清理監聽器
                if (bleMonitorRef.current) {
                  try {
                    bleMonitorRef.current.remove();
                  } catch (e) {
                    console.log("移除監聽器失敗:", e);
                  }
                  bleMonitorRef.current = null;
                }
              });
              
              // 連接成功
              connectionStateRef.current = 'connected';
              bleDeviceRef.current = connected;
              setPermissionStatus(prev => ({ ...prev, wt901Connected: true }));
              console.log('WT901 連接成功且穩定');
              resolve(connected);
              
            } catch (e) { 
              console.log('WT901 連接失敗:', e);
              connectionStateRef.current = 'disconnected';
              setPermissionStatus(prev => ({ ...prev, wt901Connected: false }));
              reject(e); 
            }
          }
        });
      });
      
    } catch (e) { 
      console.log('connectWT901 整體失敗:', e);
      connectionStateRef.current = 'disconnected';
      setPermissionStatus(prev => ({ ...prev, wt901Connected: false }));
      throw e; 
    }
  }

  /**
   * 手動斷開 WT901 連接
   */
  async function disconnectWT901() {
    console.log('開始手動斷開 WT901 連接...');
    
    try {
      // 強制清理所有 BLE 狀態
      await cleanupBleState();
      console.log('WT901 手動斷開完成');
    } catch (error) {
      console.log('手動斷開 WT901 失敗:', error);
    }
  }

  /**
   * 開始監聽 WT901 通知並把加速度資料存到 vibDataRef (CSV)
   * - 使用與範例相同的 base64 解碼方式
   * - 只寫入 accX/accY/accZ，用逗號分隔，確保數據格式一致
   * - 第一列為標題列，便於後續數據處理
   */
  async function startVibRecording() {
    vibDataRef.current = ['timestamp,accX,accY,accZ'];
    const device = bleDeviceRef.current;
    if (!device) throw new Error('WT901 未連線');
    
    console.log('開始監聽 WT901 數據...');
    
    bleMonitorRef.current = device.monitorCharacteristicForService(
      serviceUUID, notifyUUID,
      (_e: Error | null, char: Characteristic | null) => {
        try {
          if (!char?.value) return;
          
          // 使用與範例相同的 base64 解碼方式
          const buffer = Uint8Array.from(base64.decode(char.value), c => c.charCodeAt(0));
          const data = parseWT901Data(buffer, device.id);
          
          if (data) {
            vibDataRef.current.push(`${data.timestamp},${data.accX.toFixed(6)},${data.accY.toFixed(6)},${data.accZ.toFixed(6)}`);
            // 可選：在開發階段顯示接收到的數據
            // console.log('收到 WT901 數據:', data.accX.toFixed(3), data.accY.toFixed(3), data.accZ.toFixed(3));
          }
        } catch (error) {
          console.log('解析 WT901 數據失敗:', error);
        }
      }
    );
  }

  /**
   * 停止監聽並把 txt 儲存到 App 文件夾
   * - 檔名：{MRN}-{YYYYMMDDHHMMSS}-{pos}.txt（UTC ISO 去符號後前14碼），確保檔名唯一且易於識別
   * - 回傳儲存路徑，便於後續操作
   */
  async function stopVibRecording(pos: Pos): Promise<string> {
    if (bleMonitorRef.current) {
      bleMonitorRef.current.remove();
      bleMonitorRef.current = null;
    }
    const content = vibDataRef.current.join('\n');
    const filename = `${mrn}-${new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,14)}-${pos}.txt`;
    const path = FileSystem.documentDirectory! + filename;
    await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
    return path;
  }

  /**
   * 進入單一位置的錄製流程（依目前模式決定要做什麼）
   * - both：引導進入批次流程（先所有位置音訊→再所有位置震動）
   * - 單一模式：直接錄該位置，根據選擇的模式進行相應的錄製操作
   */
  async function recordOne(pos: Pos) {
    if (isRecording) return;
    if (!mode) { Alert.alert('請先選擇錄製模式'); return; }
    
    if (mode === 'both') {
      // both 模式：檢查是否需要開始批次錄製
      if (!bothModePhase) {
        startBothModeRecording();
        return;
      }
      
      // 批次錄製中，檢查當前階段
      if (bothModePhase === 'audio') {
        await recordSingleAudio(pos);
      } else if (bothModePhase === 'vib') {
        await recordSingleVibration(pos);
      }
    } else {
      // 單一模式錄製
      setIsModeLocked(true);
      setIsRecording(true);
      setGlobalCountdown(RECORDING_DURATION);
      
      try {
        setList(s => s.map(x => x.pos===pos ? {...x, status:'recording', countdown:0} : x));
        
        if (mode === 'audio') {
          await recordAudio(pos);
        } else if (mode === 'vib') {
          await recordVibration(pos);
        }
        
      } catch (e: any) {
        Alert.alert('錄製失敗', String(e?.message || e));
        setList(s => s.map(x => x.pos===pos ? {...x, status:'idle', countdown:0} : x));
      } finally {
        setIsRecording(false);
        setGlobalCountdown(0);
      }
    }
  }

  /**
   * 開始 both 批次流程的對話框（先音後震）
   * - 提示用戶即將開始批次錄製，並引導用戶進入錄製流程
   */
  function startBothModeRecording() {
    Alert.alert(
      '音訊+震動錄製',
      '將先進行所有位置的音訊錄製（位置1→2→3），再進行所有位置的震動錄製（位置1→2→3）',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '開始音訊錄製', 
          onPress: () => {
            setIsModeLocked(true);
            setBothModePhase('audio');
          }
        }
      ]
    );
  }

  /**
   * both 模式：執行單一位置的音訊錄製
   * - 完成後檢查是否所有位置的音訊皆已完成，若是則切換至震動階段
   * - 確保所有位置的音訊錄製完成後，進入下一階段
   */
  async function recordSingleAudio(pos: Pos) {
    setIsRecording(true);
    setGlobalCountdown(RECORDING_DURATION);
    
    try {
      setList(s => s.map(x => x.pos===pos ? {...x, status:'recording', countdown:0} : x));
      await recordAudio(pos);
      
      // 檢查是否完成所有音訊錄製
      const updatedList = list.map(x => x.pos===pos ? {...x, status:'done', audioPath: 'temp'} : x);
      const allAudioDone = updatedList.every(x => x.audioPath);
      
      if (allAudioDone) {
        Alert.alert(
          '音訊錄製完成',
          '所有位置的音訊錄製已完成，現在開始震動錄製',
          [
            { 
              text: '開始震動錄製', 
              onPress: () => {
                setBothModePhase('vib');
                // 重置狀態以顯示震動錄製進度
                setList(s => s.map(x => ({ ...x, status: 'idle' as const })));
              }
            }
          ]
        );
      }
      
    } catch (e: any) {
      Alert.alert('音訊錄製失敗', String(e?.message || e));
      setList(s => s.map(x => x.pos===pos ? {...x, status:'idle', countdown:0} : x));
    } finally {
      setIsRecording(false);
      setGlobalCountdown(0);
    }
  }

  /**
   * both 模式：執行單一位置的震動錄製
   * - 完成後檢查是否所有位置的震動皆已完成，若是則整體完成
   * - 確保所有位置的震動錄製完成後，結束錄製流程
   */
  async function recordSingleVibration(pos: Pos) {
    setIsRecording(true);
    setGlobalCountdown(RECORDING_DURATION);
    
    try {
      setList(s => s.map(x => x.pos===pos ? {...x, status:'recording', countdown:0} : x));
      await recordVibration(pos);
      
      // 檢查是否完成所有震動錄製
      const updatedList = list.map(x => x.pos===pos ? {...x, status:'done', vibPath: 'temp'} : x);
      const allVibDone = updatedList.every(x => x.vibPath);
      
      if (allVibDone) {
        Alert.alert('錄製完成', '所有位置的音訊和震動錄製已完成！');
        setBothModePhase(null);
      }
      
    } catch (e: any) {
      Alert.alert('震動錄製失敗', String(e?.message || e));
      setList(s => s.map(x => x.pos===pos ? {...x, status:'idle', countdown:0} : x));
    } finally {
      setIsRecording(false);
      setGlobalCountdown(0);
    }
  }

  /**
   * 實際進行音訊錄製：
   * - 準備錄音 → start → 等待 RECORDING_DURATION 秒 → stop → 移動檔案到文件夾
   * - 檔名：{MRN}-{YYYYMMDDHHMMSS}-{pos}.m4a，確保檔案命名規範
   * - 確保錄音過程順利進行，並將錄音結果保存到指定位置
   */
  async function recordAudio(pos: Pos) {
    const ok = await ensureAudio();
    if (!ok) {
      // 權限不足，更新狀態並拋出錯誤
      setPermissionStatus(prev => ({ ...prev, audio: false }));
      throw new Error('音訊權限不足');
    }
    
    const audioRec = new Audio.Recording();
    await audioRec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await audioRec.startAsync();
    recRef.current = audioRec;
    
    // 倒數計時（每秒 -1），用於顯示錄製過程中的倒數
    const timer = setInterval(() => {
      setGlobalCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    
    await new Promise(r => setTimeout(r, RECORDING_DURATION * 1000));
    clearInterval(timer);
    
    await audioRec.stopAndUnloadAsync();
    const uri = audioRec.getURI();
    recRef.current = null;
    
    if (uri) {
      const filename = `${mrn}-${new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,14)}-${pos}.m4a`;
      const dst = FileSystem.documentDirectory! + filename;
      await FileSystem.moveAsync({ from: uri, to: dst });
      
      setList(s => s.map(x => x.pos===pos ? {
        ...x, status:'done', countdown:0, audioPath: dst
      } : x));
    }
  }

  /**
   * 實際進行震動錄製：
   * - 若尚未連線 WT901 則先連線，確保設備已連接
   * - 開始監聽 → 等待 RECORDING_DURATION 秒 → 停止監聽並寫檔
   * - 確保震動數據錄製完整，並將結果保存到指定位置
   */
  async function recordVibration(pos: Pos) {
    try {
      // 檢查 WT901 是否已連線，若未連線則嘗試連接
      if (!bleDeviceRef.current) {
        await connectWT901();
      } else {
        // 檢查現有連線是否仍然有效
        const isConnected = await bleDeviceRef.current.isConnected();
        if (!isConnected) {
          console.log('WT901 連線已斷開，嘗試重新連接');
          bleDeviceRef.current = null;
          await connectWT901();
        }
      }
      await startVibRecording();
    } catch (error: any) {
      // 簡化的錯誤提示
      const errorMessage = error.message || '未知錯誤';
      Alert.alert(
        '設備連接失敗',
        `無法連接到震動感測器，請確認：\n• WT901 設備已開啟\n• 設備在藍牙範圍內\n• 藍牙權限已開啟`,
        [
          { text: '確定', style: 'cancel' }
        ]
      );
      // 更新 WT901 狀態為不可用
      setPermissionStatus(prev => ({ ...prev, wt901Connected: false }));
      throw error; // 重新拋出錯誤讓上層處理
    }
    
    // 倒數計時（每秒 -1），用於顯示錄製過程中的倒數
    const timer = setInterval(() => {
      setGlobalCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    
    await new Promise(r => setTimeout(r, RECORDING_DURATION * 1000));
    clearInterval(timer);
    
    const vibPath = await stopVibRecording(pos);
    
    setList(s => s.map(x => x.pos===pos ? {
      ...x, status:'done', countdown:0, vibPath
    } : x));
  }

  /**
   * 清除此位置的狀態（回到 idle），便於重新錄製
   */
  function redo(pos: Pos) {
    setList(s => s.map(x => x.pos===pos ? { pos, status:'idle', countdown:0 } : x));
  }

  /**
   * 重新選擇模式（解鎖並清空階段、列表），便於用戶重新設置錄製模式
   */
  function resetMode() {
    setMode(null);
    setIsModeLocked(false);
    setBothModePhase(null);
    setList([
      { pos:1, status:'idle', countdown:0 },
      { pos:2, status:'idle', countdown:0 },
      { pos:3, status:'idle', countdown:0 },
    ]);
  }

  /**
   * 上傳單一位置的檔案（依模式附上 audio/vibration）
   * - multipart/form-data：mrn/position/mode/captured_at/duration_sec + 檔案欄位
   * - 需帶 Authorization Bearer {access_token}，確保用戶已授權
   * - 回傳 measurement_id（後續做 analyze），便於後續分析
   */
  async function uploadOne(item: PosState) {
    const access = await AsyncStorage.getItem('access_token');
    const fd = new FormData();
    fd.append('mrn', mrn);
    fd.append('position', String(item.pos));
    fd.append('mode', mode as any);
    fd.append('captured_at', new Date().toISOString());
    fd.append('duration_sec', String(RECORDING_DURATION));
    if (item.audioPath && (mode==='audio' || mode==='both')) {
      fd.append('audio', { uri: item.audioPath, name: item.audioPath.split('/').pop()!, type: 'audio/m4a' } as any);
    }
    if (item.vibPath && (mode==='vib' || mode==='both')) {
      fd.append('vibration', { uri: item.vibPath, name: item.vibPath.split('/').pop()!, type: 'text/plain' } as any);
    }
    const res = await fetch(`${API_URL}/api/samples/upload`, { method:'POST', headers: { 'Authorization': `Bearer ${access}` }, body: fd });
    if (!res.ok) throw new Error('上傳失敗');
    const data = await res.json();
    return data.measurement_id as number;
  }

  /**
   * 送出分析請求（假值版本）
   * - analysis 參數：both => 'fusion'，其餘為當前 mode
   * - 回傳 JSON（預期有 result: 'good' | 'bad'），便於用戶了解分析結果
   */
  async function analyzeOne(measurementId: number) {
    const access = await AsyncStorage.getItem('access_token');
    const fd = new FormData();
    fd.append('measurement_id', String(measurementId));
    fd.append('analysis', mode==='both' ? 'fusion' : (mode as any));
    const res = await fetch(`${API_URL}/api/samples/analyze`, { method:'POST', headers: { 'Authorization': `Bearer ${access}` }, body: fd });
    if (!res.ok) throw new Error('分析失敗');
    return res.json();
  }

  /**
   * 批次上傳所有已完成的位置，並逐一呼叫分析
   * - 若任一分析回傳 bad，最終彈窗顯示 bad，否則 good
   * - 確保所有位置的數據都已上傳並分析，便於用戶了解整體結果
   */
  async function uploadAll() {
    if (!mrn) { 
      Alert.alert('需要病例號', '請先到個人資料頁面設定您的病例號 (MRN)'); 
      return; 
    }
    if (!mode) { 
      Alert.alert('請選擇模式', '請先選擇錄製模式再進行上傳'); 
      return; 
    }
    const ready = list.filter(x => x.status === 'done');
    if (ready.length === 0) { 
      Alert.alert('無錄製資料', '請先完成位置錄製再進行上傳分析'); 
      return; 
    }
    
    try {
      // 顯示上傳進度
      Alert.alert('開始上傳', `正在上傳 ${ready.length} 個位置的錄製資料...`);
      
      const ids: number[] = [];
      for (const it of ready) {
        try {
          ids.push(await uploadOne(it));
        } catch (uploadError: any) {
          throw new Error(`位置 ${it.pos} 上傳失敗：${uploadError.message || '網路錯誤'}`);
        }
      }
      
      // 進行分析
      let anyBad = false;
      for (const mid of ids) { 
        try {
          const r = await analyzeOne(mid); 
          anyBad ||= (r?.result === 'bad'); 
        } catch (analyzeError: any) {
          throw new Error(`分析失敗：${analyzeError.message || '伺服器錯誤'}`);
        }
      }
      
      Alert.alert(
        '分析完成', 
        anyBad ? '檢測結果：需要進一步檢查' : '檢測結果：狀況良好',
        [{ text: '確定' }]
      );
    } catch (e: any) { 
      Alert.alert('上傳失敗', e?.message || '請檢查網路連接後重試'); 
    }
  }

  /**
   * 模式選擇按鈕（三個：音訊/震動/音訊+震動）
   * - 已鎖定時只能點選目前模式，其他按鈕 disabled，確保用戶不會誤操作
   * - 選擇震動相關模式時檢查權限
   */
  function ModeBtn({m}:{m:Mode}) {
    const active = mode===m;
    const disabled = isModeLocked && mode !== m;
    
    const handleModeSelect = () => {
      // 檢查錄音權限（所有模式都需要）
      if (!permissionStatus.audio) {
        Alert.alert(
          '需要麥克風權限',
          '錄製功能需要使用麥克風，請前往系統設定開啟權限。',
          [
            { text: '取消', style: 'cancel' },
            { text: '前往設定', onPress: () => openAppSettings() },
          ]
        );
        return;
      }
      
      // 如果選擇震動相關模式，檢查額外權限
      if (m === 'vib' || m === 'both') {
        const issues = [];
        
        if (!permissionStatus.bluetooth) {
          issues.push('請開啟藍牙');
        }
        if (!permissionStatus.nearbyDevices) {
          issues.push('需要附近裝置權限');
        }
        if (!permissionStatus.wt901Connected) {
          issues.push('WT901 感測器未連接');
        }
        
        if (issues.length > 0) {
          const message = `震動錄製需要：\n\n${issues.map(item => `• ${item}`).join('\n')}\n\n請檢查上方設備狀態並完成設置。`;
          Alert.alert(
            '震動錄製設置',
            message,
            [
              { text: '取消', style: 'cancel' },
              { text: '重新檢查', onPress: () => checkAllPermissions() },
            ]
          );
          return;
        }
      }
      
      setMode(m);
    };
    
    return (
      <TouchableOpacity 
        disabled={disabled}
        style={[styles.modeBtn, active ? styles.modeBtnActive : null, disabled ? styles.disabled : null]} 
        onPress={handleModeSelect}
      >
        <Text style={[styles.modeText, active ? styles.modeTextActive : null, disabled ? {color:'#999'} : null]}>
          {m==='audio'?'音訊': m==='vib'?'震動':'音訊+震動'}
        </Text>
      </TouchableOpacity>
    );
  }

  /**
   * 單一卡片（位置 1/2/3）
   * - 顯示目前狀態、開始/重錄按鈕、清除按鈕，便於用戶操作
   */
  function PosCard({item}:{item:PosState}) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>位置 {item.pos}</Text>
        <Text style={styles.cardDesc}>
          {item.status === 'idle' ? '未錄製' : 
           item.status === 'recording' ? '錄製中...' : 
           item.status === 'done' ? '已完成' : '未知狀態'}
        </Text>
        <View style={{flexDirection:'row', gap:12}}>
          <TouchableOpacity
            disabled={item.status==='recording' || !mode || !mrn || isRecording}
            style={[styles.actionBtn, (item.status==='recording'||!mode||!mrn||isRecording) ? styles.disabled : null]}
            onPress={()=>recordOne(item.pos)}
          >
            <Text style={styles.actionText}>{item.status==='idle'?'開始':'重錄'}</Text>
          </TouchableOpacity>
          {item.status!=='idle' && (
            <TouchableOpacity style={[styles.redoBtn]} onPress={()=>redo(item.pos)}>
              <Text style={styles.redoText}>清除</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  /** 權限檢查中：顯示 loading 畫面，避免 UI 直接渲染主體 */
  if (!permissionsChecked) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>  
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 12, color: '#666' }}>檢查權限中...</Text>
      </View>
    );
  }

  /** 主畫面 UI */
  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.title}>AI 檢測（3 個固定位置，各 {RECORDING_DURATION} 秒）</Text>
        <Text style={styles.tip}>MRN：{mrn || '(未設定)'}</Text>
        
        {/* 設備檢查面板 - 可折疊 */}
        <View style={styles.checkPanel}>
          {/* 面板標題列 - 始終顯示 */}
          <TouchableOpacity 
            style={styles.checkPanelHeader}
            onPress={() => setIsCheckPanelExpanded(!isCheckPanelExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.checkPanelHeaderLeft}>
              <Text style={styles.checkPanelTitle}>設備檢查</Text>
              {/* 快速狀態摘要 */}
              <View style={styles.quickStatusSummary}>
                <View style={[styles.miniStatusDot, permissionStatus.audio ? styles.miniStatusSuccess : styles.miniStatusError]} />
                <View style={[styles.miniStatusDot, permissionStatus.bluetooth && permissionStatus.nearbyDevices ? styles.miniStatusSuccess : styles.miniStatusError]} />
                <View style={[styles.miniStatusDot, permissionStatus.wt901Connected ? styles.miniStatusSuccess : styles.miniStatusWarning]} />
              </View>
            </View>
            <View style={styles.checkPanelHeaderRight}>
              <TouchableOpacity 
                style={styles.refreshButton} 
                onPress={(e) => {
                  e.stopPropagation();
                  checkAllPermissions();
                }}
              >
                <Text style={styles.refreshIcon}>🔄</Text>
              </TouchableOpacity>
              <Text style={[styles.expandIcon, isCheckPanelExpanded && styles.expandIconRotated]}>
                ▼
              </Text>
            </View>
          </TouchableOpacity>
          
          {/* 展開內容 */}
          {isCheckPanelExpanded && (
            <View style={styles.checkPanelContent}>
              {/* 權限檢查項目 */}
              <View style={styles.checkItems}>
                {/* 麥克風權限 */}
                <View style={styles.checkItem}>
                  <View style={styles.checkItemLeft}>
                    <View style={[styles.checkIcon, permissionStatus.audio ? styles.checkIconSuccess : styles.checkIconError]}>
                      <Text style={styles.checkIconText}>
                        {permissionStatus.audio ? '✓' : '✕'}
                      </Text>
                    </View>
                    <View style={styles.checkItemInfo}>
                      <Text style={styles.checkItemTitle}>麥克風權限</Text>
                      <Text style={styles.checkItemDesc}>錄音檢測需要</Text>
                    </View>
                  </View>
                  <Text style={[styles.checkItemStatus, permissionStatus.audio ? styles.statusSuccess : styles.statusError]}>
                    {permissionStatus.audio ? '已授權' : '未授權'}
                  </Text>
                </View>
                
                {/* 藍牙權限 */}
                <View style={styles.checkItem}>
                  <View style={styles.checkItemLeft}>
                    <View style={[styles.checkIcon, permissionStatus.bluetooth && permissionStatus.nearbyDevices ? styles.checkIconSuccess : styles.checkIconError]}>
                      <Text style={styles.checkIconText}>
                        {permissionStatus.bluetooth && permissionStatus.nearbyDevices ? '✓' : '✕'}
                      </Text>
                    </View>
                    <View style={styles.checkItemInfo}>
                      <Text style={styles.checkItemTitle}>藍牙權限</Text>
                      <Text style={styles.checkItemDesc}>設備連接需要</Text>
                    </View>
                  </View>
                  <Text style={[styles.checkItemStatus, permissionStatus.bluetooth && permissionStatus.nearbyDevices ? styles.statusSuccess : styles.statusError]}>
                    {permissionStatus.bluetooth && permissionStatus.nearbyDevices ? '已開啟' : '未開啟'}
                  </Text>
                </View>
                
                {/* WT901 設備 */}
                <View style={styles.checkItem}>
                  <View style={styles.checkItemLeft}>
                    <View style={[styles.checkIcon, permissionStatus.wt901Connected ? styles.checkIconSuccess : styles.checkIconWarning]}>
                      <Text style={styles.checkIconText}>
                        {permissionStatus.wt901Connected ? '✓' : '◯'}
                      </Text>
                    </View>
                    <View style={styles.checkItemInfo}>
                      <Text style={styles.checkItemTitle}>震動感測器</Text>
                      <Text style={styles.checkItemDesc}>WTC2-B-B5</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={[styles.connectButton, permissionStatus.wt901Connected && styles.connectButtonConnected]}
                    onPress={async () => {
                      if (permissionStatus.wt901Connected) {
                        // 已連接時，點擊斷開
                        Alert.alert(
                          '確認斷開',
                          '是否要斷開 WT901 設備連接？',
                          [
                            { text: '取消', style: 'cancel' },
                            { 
                              text: '斷開', 
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  await disconnectWT901();
                                  Alert.alert('斷開成功', 'WT901 設備已斷開連接');
                                } catch (error: any) {
                                  Alert.alert('斷開失敗', error.message || '斷開設備時發生錯誤');
                                }
                              }
                            }
                          ]
                        );
                        return;
                      }
                      
                      // 未連接時，點擊連接
                      try {
                        Alert.alert('連接中', '正在嘗試連接 WT901 設備，請稍候...');
                        await connectWT901();
                        Alert.alert('連接成功', 'WT901 設備連接成功！');
                      } catch (error: any) {
                        Alert.alert(
                          '連接失敗', 
                          `無法連接 WT901 設備\n\n錯誤：${error.message || '未知錯誤'}\n\n請確認：\n• 設備已開啟\n• 設備在藍牙範圍內\n• 藍牙權限已開啟`,
                          [
                            { text: '確定', style: 'cancel' },
                            { text: '重新檢查權限', onPress: () => checkAllPermissions() }
                          ]
                        );
                      }
                    }}
                  >
                    <Text style={[styles.connectButtonText, permissionStatus.wt901Connected && styles.connectButtonTextConnected]}>
                      {permissionStatus.wt901Connected ? '斷開' : '連接'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* 快捷操作 */}
              <View style={styles.quickActionsRow}>
                <TouchableOpacity style={styles.settingsButton} onPress={openAppSettings}>
                  <Text style={styles.settingsButtonText}>系統設定</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
        
        <Text style={styles.section}>
          STEP 1：模式選擇 {isModeLocked ? '(已鎖定)' : ''}
          {bothModePhase ? ` - 當前階段：${bothModePhase === 'audio' ? '音訊錄製' : '震動錄製'}` : ''}
        </Text>
        <View style={{flexDirection:'row', gap:8, marginBottom:8}}>
          <ModeBtn m="audio" />
          <ModeBtn m="vib" />
          <ModeBtn m="both" />
        </View>
        {isModeLocked && (
          <TouchableOpacity style={styles.resetBtn} onPress={resetMode}>
            <Text style={styles.resetText}>重新選擇模式</Text>
          </TouchableOpacity>
        )}
        
        <Text style={styles.section}>STEP 2：逐位置錄製</Text>
        {list.map(x => <PosCard key={x.pos} item={x} />)}
        
        <Text style={styles.section}>STEP 3：上傳與分析</Text>
        <TouchableOpacity style={[styles.uploadBtn]} onPress={uploadAll}>
          <Text style={styles.uploadText}>上傳並分析</Text>
        </TouchableOpacity>
        <Text style={styles.small}>後端可用性檢測(假值) → 分析(假值) → 回傳 good/bad</Text>
      </ScrollView>
      
      {/* 錄製時的半遮罩（顯示倒數與提示） */}
      <Modal visible={isRecording} transparent animationType="fade">
        <View style={styles.recordingOverlay}>
          <View style={styles.recordingModal}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.recordingText}>錄製中...</Text>
            <Text style={styles.countdownText}>{globalCountdown}s</Text>
            <Text style={styles.recordingTip}>請勿離開此頁面</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** 風格樣式（保持不動，只加註解） */
const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#fff' },
  scrollView: { flex:1 },
  scrollContent: { padding:16, paddingBottom:40 },
  title: { fontSize:18, fontWeight:'bold', marginBottom:8 },
  tip: { color:'#666', marginBottom:12 },
  section: { marginTop:16, marginBottom:8, fontWeight:'bold' },
  modeBtn: { paddingVertical:10, paddingHorizontal:12, borderWidth:1, borderColor:'#999', borderRadius:8 },
  modeBtnActive: { backgroundColor:'#007AFF', borderColor:'#007AFF' },
  modeText: { color:'#333' },
  modeTextActive: { color:'#fff' },
  card: { borderWidth:1, borderColor:'#eee', borderRadius:10, padding:12, marginBottom:10 },
  cardTitle: { fontWeight:'bold' },
  cardDesc: { color:'#666', marginVertical:6 },
  actionBtn: { paddingVertical:8, paddingHorizontal:14, backgroundColor:'#007AFF', borderRadius:6 },
  actionText: { color:'#fff' },
  disabled: { opacity:0.4 },
  redoBtn: { paddingVertical:8, paddingHorizontal:14, backgroundColor:'#eee', borderRadius:6 },
  redoText: { color:'#333' },
  uploadBtn: { paddingVertical:12, alignItems:'center', backgroundColor:'#34C759', borderRadius:8, marginTop:6 },
  uploadText: { color:'#fff', fontWeight:'bold' },
  small: { color:'#666', marginTop:6 },
  resetBtn: { paddingVertical:8, paddingHorizontal:12, backgroundColor:'#FF9500', borderRadius:6, alignSelf:'flex-start' },
  resetText: { color:'#fff', fontSize:12 },
  recordingOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center' },
  recordingModal: { backgroundColor:'#fff', padding:24, borderRadius:12, alignItems:'center' },
  recordingText: { fontSize:18, fontWeight:'bold', marginTop:12 },
  countdownText: { fontSize:32, fontWeight:'bold', color:'#007AFF', marginTop:8 },
  recordingTip: { fontSize:14, color:'#666', marginTop:8 },
  // 設備檢查面板樣式
  checkPanel: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E9ECEF'
  },
  checkPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4
  },
  checkPanelHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  checkPanelHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  checkPanelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1D1D1F',
    marginRight: 12
  },
  checkPanelContent: {
    marginTop: 16
  },
  // 快速狀態摘要
  quickStatusSummary: {
    flexDirection: 'row',
    gap: 6
  },
  miniStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E5EA'
  },
  miniStatusSuccess: {
    backgroundColor: '#28A745'
  },
  miniStatusError: {
    backgroundColor: '#DC3545'
  },
  miniStatusWarning: {
    backgroundColor: '#FFC107'
  },
  // 展開箭頭
  expandIcon: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 8,
    transform: [{ rotate: '0deg' }]
  },
  expandIconRotated: {
    transform: [{ rotate: '180deg' }]
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  refreshIcon: {
    fontSize: 14,
    color: '#FFFFFF'
  },
  checkItems: {
    gap: 16
  },
  checkItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF'
  },
  checkItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  checkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  checkIconSuccess: {
    backgroundColor: '#D4EDDA',
    borderColor: '#28A745',
    borderWidth: 1
  },
  checkIconError: {
    backgroundColor: '#F8D7DA',
    borderColor: '#DC3545',
    borderWidth: 1
  },
  checkIconWarning: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFC107',
    borderWidth: 1
  },
  checkIconText: {
    fontSize: 16,
    fontWeight: '700'
  },
  checkItemInfo: {
    flex: 1
  },
  checkItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 2
  },
  checkItemDesc: {
    fontSize: 14,
    color: '#6C757D'
  },
  checkItemStatus: {
    fontSize: 14,
    fontWeight: '600'
  },
  statusSuccess: {
    color: '#28A745'
  },
  statusError: {
    color: '#DC3545'
  },
  connectButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    minWidth: 70
  },
  connectButtonConnected: {
    backgroundColor: '#DC3545' // 改為紅色，表示斷開功能
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center'
  },
  connectButtonTextConnected: {
    color: '#FFFFFF'
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16
  },
  settingsButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#6C757D',
    minWidth: 120
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center'
  }
});
