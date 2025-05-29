// app/Hospital-registration.tsx

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
import { Stack } from 'expo-router'; // ✅
import { API_URL } from '../appgol_config';


const ITEM_WIDTH = 60; // FlatList 每個日期框的寬度，含 margin

// 後端 Hospital 代碼對照
const hospitalMap: Record<string,string> = {
  A: "義大醫院",
  C: "義大癌治療醫院",
  D: "義大大昌醫院",
};
// ShiftNo 對照中文
const shiftMap: Record<string,string> = {
  "1": "上午",
  "2": "下午",
  "3": "晚上",
};

const shifts = [
  { label: '早上 08:30–12:00', shiftNo: '1' },
  { label: '下午 13:30–17:00', shiftNo: '2' },
  { label: '晚上 18:30–20:00', shiftNo: '3' },
];

export default function HospitalRegistration() {
  const router = useRouter();
  const today = moment().startOf('day');

  const [schedule, setSchedule] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  // 選中的日期與時段
  const [selectedDate, setSelectedDate] = useState(today.format('YYYY-MM-DD'));
  const [selectedShift, setSelectedShift] = useState('1');

  // 最後有排班的那一天 (e.g. 2025-06-30)
  const [lastDate, setLastDate] = useState<moment.Moment | null>(null);

  // FlatList ref
  const flatListRef = useRef<FlatList<moment.Moment>>(null);

  // 1. 取 schedule + 計算 lastDate
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

  // 2. allDates 從 today 到 lastDate
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

  // 3. 當 selectedDate 改變後，自動捲 FlatList
  useEffect(() => {
    const idx = allDates.findIndex(d => d.isSame(selectedDate, 'day'));
    if (idx >= 0) {
      flatListRef.current?.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 0.5, // 居中
      });
    }
  }, [selectedDate, allDates]);

  // 篩出當日 & 選中時段的 list，再依院區分組
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

  // 處理上一週/下一週
  const handleWeekChange = (dir: 'prev' | 'next') => {
    let m = moment(selectedDate);
    m = dir === 'prev' ? m.subtract(7, 'days') : m.add(7, 'days');
    if (m.isBefore(today, 'day')) m = today.clone();
    if (lastDate && m.isAfter(lastDate, 'day')) m = lastDate.clone();
    setSelectedDate(m.format('YYYY-MM-DD'));
  };

  const handleRegister = (url: string) => {
    router.push(url as any);
  };

  return (
        <>
      {/* ✅ 新增：隱藏標題列 */}
      <Stack.Screen options={{ headerShown: false }} />
    <ScrollView style={styles.container}>
      <Text style={styles.header}>掛號 ({selectedDate})</Text>

      {/* 星期導航 */}
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
            const str = item.format('YYYY-MM-DD');
            const isPast = item.isBefore(today, 'day');
            const hasDoctor = (schedule[str] || []).length > 0;
            const isDisabled = isPast || !hasDoctor;
            const isSelected = str === selectedDate;
            return (
              <TouchableOpacity
                disabled={isDisabled}
                onPress={() => setSelectedDate(str)}
                style={[
                  styles.dateBox,
                  isSelected && styles.dateBoxActive,
                  isDisabled && styles.dateBoxDisabled
                ]}
              >
                <Text style={[
                  styles.dateText,
                  isSelected && styles.dateTextActive,
                  isDisabled && styles.dateTextDisabled
                ]}>
                  {item.format('MM/DD')}
                </Text>
                <Text style={[
                  styles.dateText,
                  isSelected && styles.dateTextActive,
                  isDisabled && styles.dateTextDisabled
                ]}>
                  {item.format('dd')}
                </Text>
              </TouchableOpacity>
            );
          }}
        />

        <TouchableOpacity
          onPress={() => handleWeekChange('next')}
          disabled={!lastDate || moment(selectedDate).add(7, 'days').isAfter(lastDate, 'day')}
          style={[
            styles.navButton,
            (!lastDate || moment(selectedDate).add(7, 'days').isAfter(lastDate, 'day'))
              && styles.navButtonDisabled
          ]}
        >
          <Text style={styles.navText}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      {/* 時段切換 */}
      <View style={styles.shiftsRow}>
        {shifts.map(s => (
          <TouchableOpacity
            key={s.shiftNo}
            style={[
              styles.shiftBtn,
              selectedShift === s.shiftNo && styles.shiftBtnActive
            ]}
            onPress={() => setSelectedShift(s.shiftNo)}
          >
            <Text style={
              selectedShift === s.shiftNo
                ? styles.shiftTextActive
                : styles.shiftText
            }>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 醫院、醫師列表 */}
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

              const status = doc.status; // 'available' or 'full'

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

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: '#fff' },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },

  weekNavRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  navButton: { padding: 5, marginHorizontal: 4 },
  navButtonDisabled: { opacity: 0.3 },
  navText: { fontSize: 18, fontWeight: 'bold' },

  dateBox: {
    width: ITEM_WIDTH - 8,
    alignItems: 'center',
    paddingVertical: 6,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  dateBoxActive: { backgroundColor: '#007AFF' },
  dateBoxDisabled: { backgroundColor: '#ddd' },
  dateText: { color: '#333' },
  dateTextActive: { color: '#fff', fontWeight: 'bold' },
  dateTextDisabled: { color: '#999' },

  shiftsRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 10 },
  shiftBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#eee',
  },
  shiftBtnActive: { backgroundColor: '#007AFF' },
  shiftText: { color: '#333' },
  shiftTextActive: { color: '#fff', fontWeight: 'bold' },

  hospitalBlock: { marginTop: 15 },
  hospitalTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },

  doctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  doctorName: { fontSize: 16, fontWeight: '600' },
  registeredText: { color: '#666', marginTop: 4 },

  bookBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  bookBtnDisabled: { backgroundColor: '#999' },
  bookText: { color: '#fff', fontWeight: 'bold' },
});
