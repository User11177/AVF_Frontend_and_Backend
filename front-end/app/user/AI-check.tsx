/* 
  檔名：AICheck.tsx（推測）
  功能：三個固定位置的資料蒐集（音訊 m4a 與 WT901 震動 txt），並上傳到後端進行「可用性檢測 + 分析」。
  限制：僅加入註解，未更動任何一行邏輯或程式碼。
*/

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { BleManager, Characteristic } from 'react-native-ble-plx';
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

  /** expo-av 的 Recording 參考，用於控制錄音功能 */
  const recRef = useRef<Audio.Recording | null>(null);
  /** BLE 管理器與當前連線裝置/監聽 handle，用於管理藍牙連接和數據監聽 */
  const bleManagerRef = useRef(new BleManager());
  const bleDeviceRef = useRef<any>(null);
  const bleMonitorRef = useRef<any>(null);

  /** 收集中的震動資料（字串陣列，最終 join 成 CSV），用於存儲錄製的震動數據 */
  const vibDataRef = useRef<string[]>([]);

  /**
   * 初始化：讀 MRN、檢查權限（錄音/藍牙）
   * - 使用 useEffect 在組件掛載時執行，確保在組件初始化時進行必要的設置
   * - 獲取用戶的 MRN，若未設置則提示用戶設置
   * - 檢查錄音和藍牙的權限，確保應用有權限進行錄製和藍牙操作
   */
  useEffect(() => {
    (async () => {
      const m = await AsyncStorage.getItem('user_mrn');
      if (!m) Alert.alert('缺少病例號','請先於個人資料設定病例號(MRN)');
      setMrn(m || '');
      
      // 檢查權限（錄音 & 藍牙）
      await checkAllPermissions();
    })();
  }, []);

  /**
   * 同步檢查錄音與藍牙權限
   * - 若未授權，提示引導使用者前往系統設定
   * - 使用 Promise.all 同時檢查多個權限，確保所有必要權限都已授予
   */
  async function checkAllPermissions() {
    try {
      const results = await Promise.all([
        checkAudioPermission(),
        checkBluetoothPermission(),
      ]);
      
      const allGranted = results.every(r => r);
      if (!allGranted) {
        Alert.alert(
          '權限不足',
          '此功能需要錄音與藍牙權限，請前往設定開啟',
          [
            { text: '取消', style: 'cancel' },
            { text: '重新檢查', onPress: checkAllPermissions },
          ]
        );
      }
      setPermissionsChecked(true);
    } catch (e) {
      console.warn('權限檢查失敗:', e);
      setPermissionsChecked(true);
    }
  }

  /**
   * 檢查/請求錄音權限（使用 expo-av）
   * - 返回 Promise，表示是否授權，確保應用有權限進行錄音
   */
  async function checkAudioPermission(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * 檢查藍牙是否可用（react-native-ble-plx）
   * - 注意：某些平台無法直接檢查，這裡失敗時先回 true，讓實際連線時再處理
   * - 確保藍牙功能可用，否則在連接時處理錯誤
   */
  async function checkBluetoothPermission(): Promise<boolean> {
    try {
      const manager = bleManagerRef.current;
      const state = await manager.state();
      return state === 'PoweredOn';
    } catch {
      return true;
    }
  }

  /**
   * 確保錄音可用：再次確認權限並設定 iOS 靜音錄製
   * - 若未授權，顯示提示，確保用戶知曉需要授權
   */
  async function ensureAudio() {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') { Alert.alert('權限不足','請允許錄音權限'); return false; }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    return true;
  }

  /**
   * 掃描並連線 WT901（以名稱或 MAC 片段識別）
   * - 掃描 10 秒 timeout，確保在合理時間內完成掃描
   * - 成功後 discover 服務/特徵並保存裝置參考，準備進行數據監聽
   */
  async function connectWT901() {
    try {
      const manager = bleManagerRef.current;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          manager.stopDeviceScan();
          reject(new Error('掃描超時'));
        }, 10000);
        
        manager.startDeviceScan(null, null, async (err, device) => {
          if (err) { clearTimeout(timeout); manager.stopDeviceScan(); reject(err); return; }
          if (device && (device.name === 'WTC2-B-B5' || device.id?.toUpperCase().includes('DA:DC:BC'))) {
            try {
              clearTimeout(timeout);
              manager.stopDeviceScan();
              const connected = await manager.connectToDevice(device.id, {autoConnect: true});
              await connected.discoverAllServicesAndCharacteristics();
              bleDeviceRef.current = connected;
              resolve(connected);
            } catch (e) { reject(e); }
          }
        });
      });
    } catch (e) { throw e; }
  }

  /**
   * 開始監聽 WT901 通知並把加速度資料存到 vibDataRef (CSV)
   * - 只寫入 accX/accY/accZ，用逗號分隔，確保數據格式一致
   * - 第一列為標題列，便於後續數據處理
   */
  async function startVibRecording() {
    vibDataRef.current = ['timestamp,accX,accY,accZ'];
    const device = bleDeviceRef.current;
    if (!device) throw new Error('WT901 未連線');
    
    bleMonitorRef.current = device.monitorCharacteristicForService(
      serviceUUID, notifyUUID,
      (_e: Error | null, char: Characteristic | null) => {
        try {
          if (!char?.value) return;
          // Base64 → bytes
          const buffer = Uint8Array.from(atob(char.value), c => c.charCodeAt(0));
          const data = parseWT901Data(buffer, device.id);
          if (data) {
            vibDataRef.current.push(`${data.timestamp},${data.accX.toFixed(6)},${data.accY.toFixed(6)},${data.accZ.toFixed(6)}`);
          }
        } catch {}
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
    if (!ok) throw new Error('音訊權限不足');
    
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
    if (!bleDeviceRef.current) await connectWT901();
    await startVibRecording();
    
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
    if (!mrn) { Alert.alert('缺少病例號','請先於個人資料設定病例號(MRN)'); return; }
    if (!mode) { Alert.alert('請先選擇模式'); return; }
    const ready = list.filter(x => x.status === 'done');
    if (ready.length === 0) { Alert.alert('尚無可上傳資料'); return; }
    try {
      const ids: number[] = [];
      for (const it of ready) ids.push(await uploadOne(it));
      let anyBad = false;
      for (const mid of ids) { const r = await analyzeOne(mid); anyBad ||= (r?.result === 'bad'); }
      Alert.alert('分析結果', anyBad ? 'bad' : 'good');
    } catch (e:any) { Alert.alert('錯誤', String(e?.message || e)); }
  }

  /**
   * 模式選擇按鈕（三個：音訊/震動/音訊+震動）
   * - 已鎖定時只能點選目前模式，其他按鈕 disabled，確保用戶不會誤操作
   */
  function ModeBtn({m}:{m:Mode}) {
    const active = mode===m;
    const disabled = isModeLocked && mode !== m;
    return (
      <TouchableOpacity 
        disabled={disabled}
        style={[styles.modeBtn, active && styles.modeBtnActive, disabled && styles.disabled]} 
        onPress={()=>setMode(m)}
      >
        <Text style={[styles.modeText, active && styles.modeTextActive, disabled && {color:'#999'}]}>
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
          {item.status==='idle' && '未錄製'}
          {item.status==='recording' && '錄製中...'}
          {item.status==='done' && '已完成'}
        </Text>
        <View style={{flexDirection:'row', gap:12}}>
          <TouchableOpacity
            disabled={item.status==='recording' || !mode || !mrn || isRecording}
            style={[styles.actionBtn, (item.status==='recording'||!mode||!mrn||isRecording) && styles.disabled]}
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
      <Text style={styles.title}>AI 檢測（3 個固定位置，各 {RECORDING_DURATION} 秒）</Text>
      <Text style={styles.tip}>MRN：{mrn || '(未設定)'}</Text>
      
      <Text style={styles.section}>
        STEP 1：模式選擇 {isModeLocked && '(已鎖定)'}
        {bothModePhase && ` - 當前階段：${bothModePhase === 'audio' ? '音訊錄製' : '震動錄製'}`}
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
  container: { flex:1, padding:16, backgroundColor:'#fff' },
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
  recordingTip: { fontSize:14, color:'#666', marginTop:8 }
});
