// 從「待處理」、「更多」或通知打開網站的某一頁。不顯示原生標題列——網頁自己有返回鍵，
// 按了會回到列表頁或沒有上一頁，WebScreen 的 onLeave 就把這一頁關掉
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WebScreen } from '../components/WebScreen';

export default function WebPage() {
  const { path } = useLocalSearchParams<{ path?: string }>();

  const leave = (tabRoot: string | null) => {
    if (router.canGoBack()) router.back();
    // 網頁要回的是某個分頁的首頁，就切到那個分頁
    if (tabRoot) router.navigate(tabRoot as '/');
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <WebScreen path={path?.startsWith('/') ? path : '/'} onLeave={leave} />
    </SafeAreaView>
  );
}
