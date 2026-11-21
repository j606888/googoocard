// 「今天」：登入後的第一頁，是網站的 /today（下一堂課、待處理、最近上過）。
// 網頁的頁首是深綠色，所以這個分頁的安全區底色與狀態列跟著換；離開分頁就換回來
import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WebScreen } from '../../components/WebScreen';
import { refreshBadge } from '../../lib/todos';
import { colors } from '../../theme';

export default function Tab() {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      // 待處理不再是分頁，圖示上的數字改成每次回到今天頁時更新
      void refreshBadge();
      return () => setStatusBarStyle('dark');
    }, []),
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.primaryDeep }}>
      <WebScreen path="/today" />
    </SafeAreaView>
  );
}
