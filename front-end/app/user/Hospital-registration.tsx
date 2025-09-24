/**
 * 醫院掛號頁面
 * 
 * 功能：
 * 1. 顯示可用的掛號時段
 * 2. 依照日期和時段篩選醫生
 * 3. 提供掛號功能
 * 4. 顯示各醫院的可用醫生名單
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import moment from 'moment';
import { API_URL } from '../../utils/appgol_config';

// 每個日期框的寬度設定（含邊距）
const ITEM_WIDTH = 60;

/**
 * 醫院代碼對照表
 * 用於將後端的醫院代碼轉換為顯示名稱
 */
const hospitalMap: Record<string,string> = {
  A: "義大醫院",
  C: "義大癌治療醫院",
  D: "義大大昌醫院",
};

/**
 * 時段代碼對照表
 * 用於將時段代碼轉換為顯示文字
 */
const shiftMap: Record<string,string> = {
  "1": "上午",
  "2": "下午",
  "3": "晚上",
};

/**
 * 可選擇的時段定義
 */
const shifts = [
  { label: '早上 08:30–12:00', shiftNo: '1' },
  { label: '下午 13:30–17:00', shiftNo: '2' },
  { label: '晚上 18:30–20:00', shiftNo: '3' },
];

export default function HospitalRegistration() {
  const router = useRouter();
  const today = moment().startOf('day');

  // 狀態管理
  const [schedule, setSchedule] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(today.format('YYYY-MM-DD'));
  const [selectedShift, setSelectedShift] = useState('1');
  const [lastDate, setLastDate] = useState<moment.Moment | null>(null);

  // FlatList 參考
  const flatListRef = useRef<FlatList<moment.Moment>>(null);

  /**
   * 初始化：獲取排班資料
   * 1. 從 API 獲取排班資訊
   * 2. 設置最後可預約日期
   */
  useEffect(() => {
    fetch(`${API_URL}/api/schedule`)
      .then(res => res.json())
      .then(data => {
        setSchedule(data);
        const dates = Object.keys(data);
        if (dates.length) {
          const ms = dates.map(d => moment(d, 'YYYY-MM-DD'));
          setLastDate(moment.max(ms));
        }
      })
      .catch(() => Alert.alert("無法取得排班資料"))
      .finally(() => setLoading(false));
  }, []);

  /**
   * 計算可選擇的日期範圍
   * 從今天到最後可預約日期
   */
  const allDates = useMemo(() => {
    if (!lastDate) return [];
    const arr: moment.Moment[] = [];
    let cur = today.clone();
    while (cur.isSameOrBefore(lastDate, 'day')) {
      arr.push(cur.clone());
      cur.add(1, 'day');
    }
    return arr;
  }, [today, lastDate]);

  /**
   * 當選擇日期變更時，自動捲動日期選擇器
   */
  useEffect(() => {
    const idx = allDates.findIndex(d => d.isSame(selectedDate, 'day'));
    if (idx >= 0) {
      flatListRef.current?.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 0.5, // 置中顯示
      });
    }
  }, [selectedDate, allDates]);

  /**
   * 根據選擇的日期和時段篩選並分組醫生清單
   */
  const groupedDoctors = useMemo(() => {
    const docs = schedule[selectedDate] || [];
    const filtered = docs.filter(doc => {
      const p = new URLSearchParams(doc.url.split('?')[1]);
      return p.get('ShiftNo') === selectedShift;
    });
    const grp: Record<string, any[]> = {};
    filtered.forEach(doc => {
      const p = new URLSearchParams(doc.url.split('?')[1]);
      const h = p.get('Hospital') || '';
      const name = hospitalMap[h] || h;
      if (!grp[name]) grp[name] = [];
      grp[name].push(doc);
    });
    return grp;
  }, [schedule, selectedDate, selectedShift]);

  /**
   * 檢查指定日期和時段是否有排班
   */
  const hasScheduleForShift = (date: string, shiftNo: string) => {
    const docs = schedule[date] || [];
    return docs.some(doc => {
      const p = new URLSearchParams(doc.url.split('?')[1]);
      return p.get('ShiftNo') === shiftNo;
    });
  };

  /**
   * 處理週次變更
   * 可向前或向後切換一週
   */
  const handleWeekChange = (dir: 'prev' | 'next') => {
    let m = moment(selectedDate);
    m = dir === 'prev' ? m.subtract(7, 'days') : m.add(7, 'days');
    if (m.isBefore(today, 'day')) m = today.clone();
    if (lastDate && m.isAfter(lastDate, 'day')) m = lastDate.clone();
    setSelectedDate(m.format('YYYY-MM-DD'));
  };

  /**
   * 處理掛號請求
   */
  const handleRegister = (url: string) => {
    router.push(url as any);
  };

  /**
   * 處理時段選擇
   */
  const handleShiftSelect = (shiftNo: string) => {
    // 檢查選擇的時段是否有排班
    if (hasScheduleForShift(selectedDate, shiftNo)) {
      setSelectedShift(shiftNo);
    }
  };

  return (
    <>
      <ScrollView style={styles.container}>
        <Text style={styles.header}>掛號 ({selectedDate})</Text>

        {/* 週次導航 */}
        <View style={styles.weekNavRow}>
          <TouchableOpacity
            onPress={() => handleWeekChange('prev')}
            disabled={moment(selectedDate).isSameOrBefore(today, 'day')}
            style={[
              styles.navButton,
              moment(selectedDate).isSameOrBefore(today, 'day') && styles.navButtonDisabled
            ]}
          >
            <Text style={styles.navText}>{'<'}</Text>
          </TouchableOpacity>

          {/* 日期選擇器 */}
          <FlatList
            ref={flatListRef}
            horizontal
            data={allDates}
            keyExtractor={item => item.format('YYYY-MM-DD')}
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, index) => ({
              length: ITEM_WIDTH,
              offset: ITEM_WIDTH * index,
              index
            })}
          renderItem={({ item }) => {
            const isSelected = item.isSame(selectedDate, 'day');
            const isToday = item.isSame(today, 'day');
            const itemStr = item.format('YYYY-MM-DD');
            const hasSchedule = schedule[itemStr] && schedule[itemStr].length > 0;

            return (
              <TouchableOpacity
                disabled={!hasSchedule}
                style={[
                  styles.dateButton,
                  isSelected && styles.dateButtonSelected,
                  isToday && styles.dateButtonToday,
                  !hasSchedule && { opacity: 0.4 }
                ]}
                onPress={() => setSelectedDate(item.format('YYYY-MM-DD'))}
              >
                <Text style={[
                  styles.dateText,
                  isSelected && styles.dateTextSelected
                ]}>
                  {item.format('MM/DD')}
                </Text>
                <Text style={[
                  styles.weekdayText,
                  isSelected && styles.weekdayTextSelected
                ]}>
                  {['日', '一', '二', '三', '四', '五', '六'][item.day()]}
                </Text>
              </TouchableOpacity>
            );
          }}

          />

          <TouchableOpacity
            onPress={() => handleWeekChange('next')}
            disabled={!lastDate || moment(selectedDate).isSameOrAfter(lastDate, 'day')}
            style={[
              styles.navButton,
              (!lastDate || moment(selectedDate).isSameOrAfter(lastDate, 'day')) && styles.navButtonDisabled
            ]}
          >
            <Text style={styles.navText}>{'>'}</Text>
          </TouchableOpacity>
        </View>

        {/* 時段選擇 */}
        <View style={styles.shiftsRow}>
          {shifts.map(s => {
            const hasSchedule = hasScheduleForShift(selectedDate, s.shiftNo);
            const isActive = selectedShift === s.shiftNo;
            const isDisabled = !hasSchedule;
            
            return (
              <TouchableOpacity
                key={s.shiftNo}
                style={[
                  styles.shiftBtn,
                  isActive && styles.shiftBtnActive,
                  isDisabled && styles.shiftBtnDisabled
                ]}
                onPress={() => handleShiftSelect(s.shiftNo)}
                disabled={isDisabled}
              >
                <Text style={[
                  styles.shiftText,
                  isActive && styles.shiftTextActive,
                  isDisabled && styles.shiftTextDisabled
                ]}>
                  {s.label}
                </Text>
                {isDisabled && (
                  <Text style={styles.noScheduleText}>無排班</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 醫生列表 */}
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />
        ) : (
          Object.entries(groupedDoctors).map(([hospital, docs]) => (
            <View key={hospital} style={styles.hospitalBlock}>
              <Text style={styles.hospitalTitle}>{hospital}</Text>
              {docs.map((doc, idx) => {
                const params = new URLSearchParams(doc.url.split('?')[1]);
                const shiftNo = params.get('ShiftNo') || '';
                const shiftLabel = shiftMap[shiftNo] || '';
                const opd = params.get('OpdDate') || '';
                const y = opd.slice(0,3), m = opd.slice(3,5), d = opd.slice(5,7);
                const dateStr = `${1911 + parseInt(y)}-${m}-${d}`;
                const status = doc.status;

                return (
                  <View key={idx} style={styles.doctorCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.doctorName}>{doc.name}</Text>
                      <Text style={styles.registeredText}>
                        {shiftLabel} {dateStr}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.bookBtn, status==='full' && styles.bookBtnDisabled]}
                      onPress={() => handleRegister(doc.url)}
                      disabled={status==='full'}
                    >
                      <Text style={styles.bookText}>
                        {status==='available' ? '我要預約' : '額滿'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

// 樣式定義
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 40,
    marginBottom: 20
  },
  weekNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20
  },
  navButton: {
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8
  },
  navButtonDisabled: {
    opacity: 0.5
  },
  navText: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  dateButton: {
    width: ITEM_WIDTH - 10,
    height: 70,
    margin: 5,
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dateButtonSelected: {
    backgroundColor: '#007AFF'
  },
  dateButtonToday: {
    borderWidth: 1,
    borderColor: '#007AFF'
  },
  dateText: {
    fontSize: 16
  },
  dateTextSelected: {
    color: '#fff'
  },
  weekdayText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4
  },
  weekdayTextSelected: {
    color: '#fff'
  },
  shiftsRow: {
    flexDirection: 'row',
    marginBottom: 20
  },
  shiftBtn: {
    flex: 1,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center'
  },
  shiftBtnActive: {
    backgroundColor: '#007AFF'
  },
  shiftBtnDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.7
  },
  shiftText: {
    color: '#333'
  },
  shiftTextActive: {
    color: '#fff'
  },
  shiftTextDisabled: {
    color: '#999'
  },
  noScheduleText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4
  },
  hospitalBlock: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15
  },
  hospitalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10
  },
  doctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '500'
  },
  registeredText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4
  },
  bookBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6
  },
  bookBtnDisabled: {
    backgroundColor: '#ccc'
  },
  bookText: {
    color: '#fff',
    fontSize: 14
  }
});
