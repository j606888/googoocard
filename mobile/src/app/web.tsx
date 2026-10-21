// 從「待處理」、「更多」或通知打開網站的某一頁
import { useLocalSearchParams } from 'expo-router';

import { WebScreen } from '../components/WebScreen';

export default function WebPage() {
  const { path } = useLocalSearchParams<{ path?: string }>();
  return <WebScreen path={path?.startsWith('/') ? path : '/'} />;
}
