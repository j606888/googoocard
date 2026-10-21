// 「待處理」：GET /api/todos（網頁版 src/service/todos.ts），網頁鈴鐺和這裡讀同一份
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { api } from './api';
import { useSession } from './session';

type StudentRef = { id: number; name: string; avatarUrl: string };

export type Todos = {
  unpaidCards: {
    id: number;
    serialNumber: number;
    cardName: string;
    finalPrice: number;
    purchaseSource: string;
    createdAt: string;
    student: StudentRef;
  }[];
  needsRenewal: { student: StudentRef; since: string }[];
  unboundAttendance: {
    id: number;
    source: string;
    student: StudentRef;
    lessonId: number;
    lessonName: string;
    lessonPeriodId: number;
    lessonPeriodStartTime: string;
  }[];
  total: number;
};

export function useTodos() {
  const { epoch } = useSession();
  const [todos, setTodos] = useState<Todos | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<Todos>('/api/todos');
      setTodos(data);
      setError(null);
      await Notifications.setBadgeCountAsync(data.total).catch(() => false);
    } catch (e) {
      setError(e);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // 每次回到這頁都重抓（例如在網站確認收款後回來），換教室（epoch 變了）也重抓
  useFocusEffect(
    useCallback(() => {
      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- epoch 只是「要重抓」的訊號
    }, [load, epoch]),
  );

  return { todos, error, refreshing, refresh };
}

// 跟網頁版 src/lib/cardSerial.ts 同一套：1 → #A0001、10000 → #B0001
export function formatCardSerial(serialNumber: number): string {
  const index = serialNumber - 1;
  const letter = String.fromCharCode(65 + Math.floor(index / 9999));
  return `#${letter}${String((index % 9999) + 1).padStart(4, '0')}`;
}

export const formatMoney = (amount: number) => Math.round(amount).toLocaleString('en-US');
