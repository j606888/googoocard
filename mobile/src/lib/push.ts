// 推播：登入後要權限、把 Expo push token 交給伺服器（POST /api/push-tokens），登出時刪掉。
// 伺服器什麼時候推見網頁版 src/service/push.ts；點通知的處理在 app/_layout.tsx
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

import { api } from './api';
import { onSignOut } from './session';

const PUSH_TOKEN_KEY = 'push-token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushData = { classroomId?: number; type?: string; path?: string };

// 登入後呼叫。使用者拒絕、模擬器、沒網路都安靜地放棄，下次打開 App 再試
export async function registerForPush(): Promise<void> {
  if (!Device.isDevice) return;
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain) {
    granted = (await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    })).granted;
  }
  if (!granted) return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api('/api/push-tokens', { method: 'POST', body: JSON.stringify({ token, platform: 'ios' }) });
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
  } catch {
    // 下次啟動再註冊
  }
}

// 登出時：這支手機不要再收到這個帳號的通知
onSignOut(async () => {
  const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  await Notifications.setBadgeCountAsync(0).catch(() => false);
  if (token) await api('/api/push-tokens', { method: 'DELETE', body: JSON.stringify({ token }) });
});

export async function notificationsAllowed(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}
