import * as Notifications from 'expo-notifications';
import { DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';

import { type PushData, registerForPush } from '../lib/push';
import { restoreSession, switchClassroom, useSession } from '../lib/session';
import { colors } from '../theme';

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.primaryDark, background: colors.bg },
};

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { status } = useSession();
  const signedIn = status === 'signedIn';

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
    if (status === 'signedIn') void registerForPush();
  }, [status]);

  useOpenNotification(signedIn);

  if (status === 'loading') return null;

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal', headerTintColor: colors.primaryDark }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="web" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

// 點通知：切到通知所屬的教室，再打開對應的頁面（學生頁、點名結果頁）。
// 用 useLastNotificationResponse 才接得到「App 被通知叫起來」那一次
function useOpenNotification(signedIn: boolean) {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!signedIn || !response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;

    const data = response.notification.request.content.data as PushData;
    void (async () => {
      if (data.classroomId) await switchClassroom(data.classroomId).catch(() => {});
      if (data.path) router.push({ pathname: '/web', params: { path: data.path } });
      else router.navigate('/');
    })();
  }, [signedIn, response]);
}
