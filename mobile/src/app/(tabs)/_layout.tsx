import { Tabs } from 'expo-router';
import { type SFSymbol, SymbolView } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { colors } from '../../theme';

// 待處理、更多是原生畫面；課程、學生、收入是網站（WebScreen）。
// 網站自己的底部導覽在 App 裡會藏起來（網頁版 src/lib/inApp.ts）
function icon(name: SFSymbol) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <SymbolView name={name} tintColor={color} size={24} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primaryDark, headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: '待處理', tabBarIcon: icon('checklist') }} />
      <Tabs.Screen name="lessons" options={{ title: '課程', tabBarIcon: icon('book') }} />
      <Tabs.Screen name="students" options={{ title: '學生', tabBarIcon: icon('person.2') }} />
      <Tabs.Screen name="income" options={{ title: '收入', tabBarIcon: icon('dollarsign.circle') }} />
      <Tabs.Screen name="more" options={{ title: '更多', tabBarIcon: icon('ellipsis.circle') }} />
    </Tabs>
  );
}
