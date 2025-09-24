// ============================================================================
// patient.tsx - 病患主介面頁面
// ============================================================================
// 
// 主要功能：
// 1. 顯示用戶基本資訊和健康狀態
// 2. 提供各種醫療服務快捷入口
// 3. 整合健康資訊管理功能
// 4. 支援掛號、AI 檢查等服務
// 5. 用戶登出功能
// 
// 頁面佈局：
// - 左上角：登出按鈕（紅色底線）
// - 右上角：個人設定按鈕
// - 中央：歡迎訊息、公告資訊、功能選單網格
// ============================================================================

// ============================================================================
// 導入必要的 React Native 組件和第三方庫
// ============================================================================
import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, 
  ScrollView, Alert, Linking 
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';           // 圖示庫 - 提供各種圖標
import { useRouter, useFocusEffect } from 'expo-router';   // 路由導航 - 頁面跳轉
import { Stack } from 'expo-router';                       // 頁面堆疊 - 導航配置
import { API_URL } from '../../utils/appgol_config';       // API 配置 - 後端服務地址
import AsyncStorage from '@react-native-async-storage/async-storage'; // 本地儲存 - 用戶資料持久化
import { authFetch } from '../../utils/authFetch';         // 認證請求工具 - 帶認證的 HTTP 請求

// ============================================================================
// 主組件：HealthInfo - 病患主介面
// ============================================================================
// 
// 組件功能：
// - 整合病患的各種醫療服務入口
// - 顯示個人健康資訊和公告
// - 提供用戶登出功能
// - 管理用戶登入狀態和個人資料
// ============================================================================
const HealthInfo = () => {
  // 路由導航器 - 用於頁面跳轉
  const router = useRouter();
  
  // ============================================================================
  // 狀態管理 (State Management)
  // ============================================================================
  const [healthInfo, setHealthInfo] = useState<any>(null);      // 健康資訊 - 從後端獲取的公告資料
  const [loading, setLoading] = useState(true);                 // 載入狀態 - 控制載入指示器顯示
  const [error, setError] = useState<string | null>(null);      // 錯誤狀態 - 儲存錯誤訊息
  const [userProfile, setUserProfile] = useState<any>(null);    // 用戶資料 - 當前登入用戶的個人資料
  const [profileLoading, setProfileLoading] = useState(true);   // 資料載入狀態 - 控制個人資料載入指示器
  const [isLoggingOut, setIsLoggingOut] = useState(false);      // 登出狀態 - 防止重複點擊
  const [displayName, setDisplayName] = useState<string>('');   // 穩定的顯示名稱 - 避免閃爍

  // ============================================================================
  // 路由焦點監聽 - 確保每次重新進入頁面時狀態都是乾淨的
  // ============================================================================
  useFocusEffect(
    useCallback(() => {
      console.log('[Patient] 頁面獲得焦點，檢查並重置狀態...');
      
      // 每次重新進入頁面時都重置狀態，防止累積閃爍
      const resetPageState = async () => {
        const token = await AsyncStorage.getItem('access_token');
        
        if (!token) {
          console.log('[Patient] 無有效 token，重置所有狀態');
          setUserProfile(null);
          setDisplayName('');
          setHealthInfo(null);
          setLoading(true);
          setError(null);
          setProfileLoading(true);
        } else {
          console.log('[Patient] 有效 token，重置部分狀態以確保乾淨載入');
          // 即使有 token，也重置一些狀態以確保乾淨的載入體驗
          setError(null);
          setLoading(true);
          // 不重置 displayName 和 userProfile，避免不必要的閃爍
        }
      };
      
      resetPageState();
    }, [])
  );

  // ============================================================================
  // 初始化處理 - 組件掛載時執行
  // ============================================================================
  useEffect(() => {
    /**
     * 初始化用戶資料 - 組件掛載時自動執行
     * 
     * 執行流程：
     * 1. 從本地儲存 (AsyncStorage) 讀取基本用戶資料
     * 2. 檢查用戶登入狀態和資料完整性
     * 3. 如需要則從後端伺服器更新完整資料
     * 4. 獲取公告資訊並更新狀態
     */
    const initUserProfile = async () => {
      try {
        // ============================================================================
        // 步驟 1: 從本地儲存 (AsyncStorage) 取得基本用戶資料
        // ============================================================================
        const userId = await AsyncStorage.getItem('user_id');           // 用戶唯一識別碼
        const phone = await AsyncStorage.getItem('user_phone');         // 用戶電話號碼
        const email = await AsyncStorage.getItem('user_email');         // 用戶電子郵件
        const fullName = await AsyncStorage.getItem('user_full_name'); // 用戶真實姓名
        const idNumber = await AsyncStorage.getItem('user_id_number'); // 用戶身分證字號
        const birthdate = await AsyncStorage.getItem('user_birthdate'); // 用戶出生日期
        const mrn = await AsyncStorage.getItem('user_mrn');            // 用戶病例號碼

        // ============================================================================
        // 步驟 2: 組合基本個人資料物件
        // ============================================================================
        const basicProfile = {
          id: userId,                    // 用戶ID
          phone,                         // 電話號碼
          email,                         // 電子郵件
          full_name: fullName,          // 真實姓名
          id_number: idNumber,          // 身分證字號
          birthdate,                    // 出生日期
          mrn                           // 病例號碼
        };

        // ============================================================================
        // 步驟 3: 登入狀態檢查 - 驗證用戶是否已登入
        // ============================================================================
        if (!userId && !phone && !email) {
          // 如果沒有找到任何用戶識別資訊，顯示登入提示
          Alert.alert(
            '未登入', 
            '找不到登入資訊，請重新登入',
            [
              { text: '取消', style: 'cancel' },                    // 取消按鈕
              { 
                text: '重新登入', 
                style: 'destructive',                               // 使用破壞性樣式（紅色）
                onPress: () => {
                  // 清除所有本地儲存的用戶資料
                  AsyncStorage.removeItem('user_id');
                  AsyncStorage.removeItem('user_phone');
                  AsyncStorage.removeItem('user_email');
                  AsyncStorage.removeItem('user_full_name');
                  AsyncStorage.removeItem('user_id_number');
                  AsyncStorage.removeItem('user_birthdate');
                  AsyncStorage.removeItem('user_mrn');
                  
                  // 導向登入頁面
                  router.replace('/');
                }
              }
            ]
          );
          setProfileLoading(false);  // 停止載入狀態
          return;                    // 提前結束函數執行
        }

        // ============================================================================
        // 步驟 4: 設定基本資料到狀態並檢查是否需要更新
        // ============================================================================
        setUserProfile(basicProfile);    // 將基本資料設定到組件狀態
        
        // 設定初始顯示名稱，避免後續變化造成閃爍
        const initialDisplayName = fullName || phone || email || '使用者';
        setDisplayName(initialDisplayName);
        
        setProfileLoading(false);        // 停止個人資料載入狀態

        // 檢查是否需要從後端伺服器更新完整資料
        // 如果缺少姓名、身分證字號或生日，則需要更新
        const needsUpdate = !fullName || !idNumber || !birthdate;
        
        // ============================================================================
        // 步驟 5: 從後端伺服器獲取完整用戶資料（如需要）
        // ============================================================================
        if (needsUpdate) {
          // 根據可用的識別資訊構建 API 請求 URL
          let url = '';
          if (userId) {
            // 優先使用用戶ID查詢
            url = `${API_URL}/api/user/profile?id=${userId}`;
          } else if (phone) {
            // 其次使用電話號碼查詢
            url = `${API_URL}/api/user/profile?phone=${phone}`;
          } else if (email) {
            // 最後使用電子郵件查詢
            url = `${API_URL}/api/user/profile?email=${email}`;
          }

          // 如果成功構建了 API URL，則發送請求獲取完整資料
          if (url) {
            try {
              const res = await authFetch(url);        // 使用認證請求工具發送請求
              const data = await res.json();           // 解析響應資料
              
              if (data && data.user) {
                const profile = data.user;             // 提取用戶資料
                
                // ============================================================================
                // 步驟 6: 更新本地儲存和組件狀態
                // ============================================================================
                // 將從後端獲取的完整資料同步到本地儲存
                await AsyncStorage.setItem('user_full_name', profile.full_name || '');
                await AsyncStorage.setItem('user_id_number', profile.id_number || '');
                await AsyncStorage.setItem('user_birthdate', profile.birthdate || '');
                await AsyncStorage.setItem('user_mrn', profile.mrn || '');
                await AsyncStorage.setItem('user_address', profile.address || '');
                await AsyncStorage.setItem('user_emergency_name', profile.emergency_name || '');
                await AsyncStorage.setItem('user_emergency_phone', profile.emergency_phone || '');
                
                setUserProfile(profile);               // 更新組件狀態
                
                // 只有在獲得更完整的名稱時才更新顯示名稱，避免從真實姓名回退到電話號碼
                const newDisplayName = profile.full_name || profile.phone || profile.email || '使用者';
                const currentDisplayName = displayName;
                
                // 優先級：真實姓名 > 電話號碼 > 電子郵件 > 使用者
                if (profile.full_name && profile.full_name.trim()) {
                  // 如果有真實姓名，總是使用真實姓名
                  setDisplayName(profile.full_name.trim());
                } else if (!currentDisplayName || currentDisplayName === '使用者') {
                  // 如果當前沒有名稱或是預設名稱，則更新為新的
                  setDisplayName(newDisplayName);
                }

                // ============================================================================
                // 步驟 7: 檢查必填欄位完整性
                // ============================================================================
                // 檢查用戶是否已填寫所有必要的個人資料
                const requiredFields = ['birthdate', 'id_number', 'address', 'emergency_name', 'emergency_phone'];
                const missing = requiredFields.filter(f => !profile[f]);
                if (missing.length > 0) {
                  // 如果有缺失的必填欄位，提醒用戶完成資料填寫
                  Alert.alert('提醒', '請至右上角完成資料填寫');
                }
              }
            } catch (error) {
              console.log('無法獲取完整用戶資料，使用基本資料:', error);
              // 使用基本資料繼續，不顯示錯誤
            }
          }
        }
              // ============================================================================
        // 錯誤處理
        // ============================================================================
        } catch (error) {
          console.error('初始化個人資料時發生錯誤:', error);
          // 改為溫和的錯誤處理，不顯示錯誤對話框
          console.log('使用基本資料繼續...');
          setProfileLoading(false);
        }
      };

      // 執行用戶資料初始化
      initUserProfile();

      // ============================================================================
      // 步驟 8: 獲取公告資料
      // ============================================================================
      // 從後端 API 獲取最新的公告資訊
      fetch(`${API_URL}/api/announcements`)
        .then(res => {
          if (!res.ok) throw new Error('無法取得健康資訊');
          return res.json();
        })
        .then(data => {
          setHealthInfo(data.data || data);  // 更新公告資訊狀態
          setLoading(false);                 // 停止載入狀態
        })
        .catch(err => {
          setError('健康資訊載入失敗');      // 設定錯誤訊息
          setLoading(false);                 // 停止載入狀態
        });
        
    // 返回清理函數，在組件卸載時清理狀態
    return () => {
      console.log('[Patient] 組件卸載，清理狀態...');
      // 組件卸載時不需要特別清理，因為組件本身就會被銷毀
    };
  }, []);  // 空依賴陣列，只在組件掛載時執行一次

  // ============================================================================
  // 登出處理函數 - 用戶登出時清除所有本地資料
  // ============================================================================
  const handleLogout = useCallback(async () => {
    // 防止重複點擊
    if (isLoggingOut) return;
    
    // 顯示確認對話框，防止誤觸登出
    Alert.alert(
      '確認登出',
      '確定要登出嗎？',
      [
        { text: '取消', style: 'cancel' },                    // 取消按鈕
        { 
          text: '登出', 
          style: 'destructive',                               // 使用破壞性樣式（紅色）
          onPress: async () => {
            if (isLoggingOut) return; // 再次檢查防止重複執行
            
            setIsLoggingOut(true);
            try {
              // ============================================================================
              // 步驟 1: 清除所有本地儲存的用戶資料
              // ============================================================================
              await AsyncStorage.removeItem('access_token');        // 清除存取令牌
              await AsyncStorage.removeItem('refresh_token');       // 清除刷新令牌
              await AsyncStorage.removeItem('user_id');            // 清除用戶ID
              await AsyncStorage.removeItem('user_phone');         // 清除電話號碼
              await AsyncStorage.removeItem('user_email');         // 清除電子郵件
              await AsyncStorage.removeItem('user_full_name');     // 清除真實姓名
              await AsyncStorage.removeItem('user_id_number');     // 清除身分證字號
              await AsyncStorage.removeItem('user_birthdate');     // 清除出生日期
              await AsyncStorage.removeItem('user_mrn');           // 清除病例號碼
              await AsyncStorage.removeItem('user_address');       // 清除地址
              await AsyncStorage.removeItem('user_emergency_name'); // 清除緊急聯絡人姓名
              await AsyncStorage.removeItem('user_emergency_phone'); // 清除緊急聯絡電話
              await AsyncStorage.removeItem('user_role');          // 清除用戶角色
              
              console.log('[Patient] 用戶已登出，清除所有本地資料');
              
              // ============================================================================
              // 步驟 2: 重置所有組件狀態，防止狀態殘留導致閃爍累積
              // ============================================================================
              setUserProfile(null);              // 重置用戶資料
              setDisplayName('');                // 重置顯示名稱
              setHealthInfo(null);               // 重置健康資訊
              setLoading(true);                  // 重置載入狀態
              setError(null);                    // 重置錯誤狀態
              setProfileLoading(true);           // 重置資料載入狀態
              
              console.log('[Patient] 組件狀態已重置');
              
              // ============================================================================
              // 步驟 3: 導向登入頁面
              // ============================================================================
              router.replace('/');  // 使用 replace 而不是 push，防止用戶返回
            } catch (error) {
              console.error('[Patient] 登出時發生錯誤:', error);
              Alert.alert('錯誤', '登出失敗，請稍後再試');
            } finally {
              setIsLoggingOut(false);
            }
          }
        }
      ]
    );
  }, [isLoggingOut, router]);

  // ============================================================================
  // 歡迎訊息生成函數 - 根據時間和用戶資料生成個性化問候語
  // ============================================================================
  const getWelcomeMessage = useCallback(() => {
    try {
      // 如果個人資料還在載入中，顯示載入提示
      if (profileLoading) return '載入中...';
      
      // 使用穩定的顯示名稱，避免閃爍
      const name = displayName || '使用者';
      
      // 根據當前時間生成問候語
      const hour = new Date().getHours();
      let timeGreeting = '';
      
      if (hour < 12) timeGreeting = '早安';        // 0-11點：早安
      else if (hour < 18) timeGreeting = '午安';   // 12-17點：午安
      else timeGreeting = '晚安';                  // 18-23點：晚安
      
      // 返回完整的歡迎訊息
      return `${timeGreeting}，${name}`;
    } catch (error) {
      console.error('生成歡迎訊息時發生錯誤:', error);
      return '歡迎使用';
    }
  }, [profileLoading, displayName]); // 使用 displayName 而不是 userProfile

  // ============================================================================
  // 組件渲染 - 返回 JSX 結構
  // ============================================================================
  return (
    <>
      {/* 隱藏預設導航標題 */}
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* 主容器 */}
      <View style={styles.wrapper}>
        {/* ============================================================================
         * 頂部按鈕區域
         * ============================================================================ */}
        
        {/* 個人設定按鈕 - 右上角 */}
        <TouchableOpacity
          style={styles.avatarBtn}
          onPress={() => router.push('/user/profile')}  // 導向個人資料設定頁面
        >
          <FontAwesome name="cog" size={48} color="#333" />  {/* 設定圖標 */}
          <Text style={styles.avatarText}>設定</Text>        {/* 設定文字 */}
        </TouchableOpacity>

        {/* 登出按鈕 - 左上角 */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}  // 觸發登出流程
        >
          <Text style={styles.logoutText}>登出</Text>  {/* 登出文字 */}
        </TouchableOpacity>

        {/* ============================================================================
         * 主要內容區域
         * ============================================================================ */}
        <View style={styles.container}>
          {/* ============================================================================
           * 歡迎訊息區域 - 顯示個性化問候語
           * ============================================================================ */}
          <Text style={styles.welcomeText}>{String(getWelcomeMessage() || '歡迎使用')}</Text>
          
          {/* ============================================================================
           * 公告資訊區域 - 顯示系統公告和健康資訊
           * ============================================================================ */}
          <Text style={styles.header}>公告</Text>
          
          {/* 公告內容可滾動區塊 - 支援多條公告顯示 */}
          <View style={styles.announcementBox}>
            <ScrollView>
              {loading ? (
                // 載入狀態：顯示載入提示
                <Text style={styles.description}>載入中...</Text>
              ) : error ? (
                // 錯誤狀態：顯示錯誤訊息（紅色）
                <Text style={[styles.description, { color: 'red' }]}>{error || '載入失敗'}</Text>
              ) : healthInfo && Array.isArray(healthInfo) && healthInfo.length > 0 ? (
                // 成功狀態：顯示公告列表
                healthInfo.map((item: any, index: number) => (
                  <View key={item.id || index} style={{ marginBottom: 16 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 18 }}>
                      {item.title ? String(item.title) : '無標題'}
                    </Text>
                    <Text style={{ color: '#444', marginTop: 4 }}>
                      {item.content ? String(item.content) : '無內容'}
                    </Text>
                  </View>
                ))
              ) : (
                // 空狀態：沒有公告時顯示提示
                <Text style={styles.description}>目前無健康資訊</Text>
              )}
            </ScrollView>
          </View>

          {/* ============================================================================
           * 功能選單網格 - 提供各種醫療服務的快捷入口
           * ============================================================================ */}
          <View style={styles.grid}>
            {/* 醫院掛號服務 - 預約門診 */}
            <MenuButton 
              icon="calendar" 
              label="掛號" 
              route="/user/Hospital-registration" 
              router={router}
            />
            
            {/* 掛號查詢服務 - 查看預約記錄 */}
            <MenuButton 
              icon="search" 
              label="掛號查詢" 
              route="/user/Hospital-register-search" 
              router={router} 
            />
            
            {/* AI 堵塞檢測服務 - 智能健康檢查 */}
            <MenuButton 
              icon="heartbeat" 
              label="堵塞偵測" 
              route="/user/AI-check" 
              router={router} 
            />
            
            {/* 醫患對話服務 - 與醫師即時溝通 */}
            <MenuButton 
              icon="comment" 
              label="醫患對話" 
              route="/user/chat" 
              router={router} 
            />
            
            {/* 檢測記錄服務 - 查看歷史檢測記錄 */}
            <MenuButton 
              icon="file-text" 
              label="檢測記錄" 
              route="/user/medical-records" 
              router={router} 
            />
            
            {/* 健康資訊服務 - 瀏覽健康相關文章 */}
            <MenuButton 
              icon="info-circle" 
              label="健康資訊" 
              route="/user/health-info" 
              router={router} 
            />
          </View>
        </View>
      </View>
    </>
  );
};

// ============================================================================
// 類型定義 - 定義路由和組件屬性的類型
// ============================================================================

// 定義可用的路由路徑類型 - 限制路由只能是預定義的頁面
type RouteType =
  | "/user/Hospital-registration"      // 醫院掛號頁面
  | "/user/Hospital-register-search"   // 掛號查詢頁面
  | "/user/AI-check"                   // AI 健康檢查頁面
  | "/user/chat"                       // 醫患對話頁面
  | "/user/medical-records"            // 檢測記錄頁面
  | "/user/health-info"                // 健康資訊頁面
  | "/user/profile";                   // 個人資料設定頁面

// 定義功能選單按鈕的屬性類型
type MenuButtonProps = {
  icon: string;        // 圖標名稱 - 使用 FontAwesome 圖標
  label: string;       // 按鈕標籤文字
  route: RouteType;    // 目標路由路徑
  router: any;         // 路由導航器實例
};

// ============================================================================
// 功能選單按鈕組件 - 可重複使用的選單按鈕
// ============================================================================
const MenuButton = ({ icon, label, route, router }: MenuButtonProps) => (
  <TouchableOpacity
    style={styles.menuButton}                    // 應用按鈕樣式
    onPress={() => {
      router.push(route);                       // 點擊時導向指定頁面
    }}
  >
    <FontAwesome name={icon as any} size={24} color="#333" />  {/* 功能圖標 */}
    <Text style={styles.menuLabel}>{label}</Text>              {/* 功能標籤 */}
  </TouchableOpacity>
);

// ============================================================================
// 樣式定義 - 使用 StyleSheet 優化樣式性能
// ============================================================================
const styles = StyleSheet.create({
  // 主容器樣式 - 整個頁面的背景容器
  wrapper: {
    flex: 1,                    // 佔滿整個可用空間
    backgroundColor: '#f5f5f5'  // 淺灰色背景
  },
  // 個人設定按鈕樣式 - 右上角齒輪圖標按鈕
  avatarBtn: {
    position: 'absolute',        // 絕對定位
    top: 40,                    // 距離頂部 40px
    right: 20,                  // 距離右側 20px
    alignItems: 'center'        // 內容水平居中
  },
  
  // 設定按鈕文字樣式
  avatarText: {
    marginTop: 4,               // 距離圖標頂部 4px
    fontSize: 12,               // 字體大小 12px
    color: '#333'               // 深灰色文字
  },
  
  // 登出按鈕樣式 - 左上角紅色登出按鈕
  logoutBtn: {
    position: 'absolute',        // 絕對定位
    top: 40,                    // 距離頂部 40px
    left: 20,                   // 距離左側 20px
    paddingHorizontal: 12,      // 左右內邊距 12px
    paddingVertical: 6,         // 上下內邊距 6px
    borderRadius: 6,            // 圓角半徑 6px
    borderWidth: 1,             // 邊框寬度 1px
    borderColor: '#ff4444'      // 紅色邊框
  },
  
  // 登出按鈕文字樣式
  logoutText: {
    fontSize: 14,               // 字體大小 14px
    color: '#ff4444',           // 紅色文字
    fontWeight: 'bold',         // 粗體字
    textDecorationLine: 'underline'  // 底線裝飾
  },
  // 主要內容容器樣式 - 包含所有頁面內容
  container: {
    flex: 1,                    // 佔滿剩餘空間
    padding: 20,                // 四周內邊距 20px
    paddingTop: 100             // 頂部內邊距 100px（為頂部按鈕留出空間）
  },
  
  // 歡迎訊息文字樣式 - 頁面頂部的問候語
  welcomeText: {
    fontSize: 24,               // 字體大小 24px
    fontWeight: 'bold',         // 粗體字
    marginBottom: 16,           // 底部外邊距 16px
    color: '#333'               // 深灰色文字
  },
  
  // 個人資料卡片樣式 - 用於顯示用戶資訊的卡片容器
  profileCard: {
    backgroundColor: '#fff',     // 白色背景
    borderRadius: 12,           // 圓角半徑 12px
    padding: 16,                // 內邊距 16px
    marginBottom: 20,           // 底部外邊距 20px
    shadowColor: '#000',        // 陰影顏色：黑色
    shadowOffset: { width: 0, height: 2 },  // 陰影偏移：向下 2px
    shadowOpacity: 0.1,         // 陰影透明度 10%
    shadowRadius: 4,            // 陰影模糊半徑 4px
    elevation: 3,               // Android 陰影深度
  },
  
  // 個人資料姓名樣式
  profileName: {
    fontSize: 18,               // 字體大小 18px
    fontWeight: 'bold',         // 粗體字
    color: '#333',              // 深灰色文字
    marginBottom: 8             // 底部外邊距 8px
  },
  
  // 個人資料詳情樣式
  profileDetail: {
    fontSize: 14,               // 字體大小 14px
    color: '#666',              // 中灰色文字
    marginBottom: 4             // 底部外邊距 4px
  },
  
  // 區段標題樣式 - 用於「公告」等標題
  header: {
    fontSize: 20,               // 字體大小 20px
    fontWeight: 'bold',         // 粗體字
    marginBottom: 10            // 底部外邊距 10px
  },
  // 公告資訊容器樣式 - 顯示系統公告的滾動區域
  announcementBox: {
    height: 100,                 // 固定高度 100px
    backgroundColor: '#fff',     // 白色背景
    borderRadius: 10,            // 圓角半徑 10px
    padding: 16,                 // 內邊距 16px
    marginBottom: 16,            // 底部外邊距 16px
    shadowColor: '#000',         // 陰影顏色：黑色
    shadowOffset: { width: 0, height: 1 },  // 陰影偏移：向下 1px
    shadowOpacity: 0.12,         // 陰影透明度 12%
    shadowRadius: 2,             // 陰影模糊半徑 2px
    elevation: 2,                // Android 陰影深度
  },
  
  // 描述文字樣式 - 用於公告內容和載入提示
  description: {
    fontSize: 16,                // 字體大小 16px
    color: '#666',               // 中灰色文字
    marginBottom: 30             // 底部外邊距 30px
  },
  
  // 功能選單網格容器樣式 - 2x3 網格佈局
  grid: {
    flexDirection: 'row',        // 水平排列
    flexWrap: 'wrap',            // 自動換行
    justifyContent: 'space-between'  // 兩端對齊，中間留空
  },
  
  // 功能選單按鈕樣式 - 每個功能按鈕的樣式
  menuButton: {
    width: '48%',                // 寬度佔容器的 48%（留出間距）
    aspectRatio: 1,              // 寬高比 1:1（正方形）
    backgroundColor: 'white',    // 白色背景
    borderRadius: 12,            // 圓角半徑 12px
    padding: 20,                 // 內邊距 20px
    marginBottom: 15,            // 底部外邊距 15px
    alignItems: 'center',        // 內容水平居中
    justifyContent: 'center',    // 內容垂直居中
    shadowColor: '#000',         // 陰影顏色：黑色
    shadowOffset: {
      width: 0,                  // 水平偏移 0px
      height: 2,                 // 垂直偏移 2px
    },
    shadowOpacity: 0.25,         // 陰影透明度 25%
    shadowRadius: 3.84,          // 陰影模糊半徑 3.84px
    elevation: 5                 // Android 陰影深度
  },
  
  // 功能選單按鈕標籤樣式 - 按鈕下方的功能名稱
  menuLabel: {
    marginTop: 12,               // 距離圖標頂部 12px
    fontSize: 16,                // 字體大小 16px
    color: '#333'                // 深灰色文字
  }
});

// ============================================================================
// 導出主組件
// ============================================================================
export default HealthInfo;
