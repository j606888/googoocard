// 用 WebView 顯示網站的某一頁。登入狀態由 /api/app/web-session 交給 WebView（見 lib/web.ts）
import * as Linking from 'expo-linking';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { signOut, useSession } from '../lib/session';
import { INJECT_BEFORE_LOAD, USER_AGENT_SUFFIX, isSameSite, pathOf, webSessionSource } from '../lib/web';
import { colors } from '../theme';

export function WebScreen({ path }: { path: string }) {
  const { token, epoch } = useSession();
  if (!token) return null;

  const onNavigation = (nav: WebViewNavigation) => {
    const p = pathOf(nav.url);
    // 在網頁裡按了登出：App 也一起登出，不然會卡在網頁的登入頁
    if (p.startsWith('/login') || p.startsWith('/signup')) void signOut();
  };

  return (
    <WebView
      // 換教室、重新登入就整個重來，拿新的 cookie
      key={`${epoch}:${path}`}
      source={webSessionSource(token, path)}
      applicationNameForUserAgent={USER_AGENT_SUFFIX}
      injectedJavaScriptBeforeContentLoaded={INJECT_BEFORE_LOAD}
      onNavigationStateChange={onNavigation}
      onShouldStartLoadWithRequest={(req) => {
        // 站外連結（LINE、mailto、tel…）交給系統開
        if (isSameSite(req.url) || req.url === 'about:blank') return true;
        void Linking.openURL(req.url);
        return false;
      }}
      pullToRefreshEnabled
      allowsBackForwardNavigationGestures
      startInLoadingState
      renderLoading={() => (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
      style={styles.web}
    />
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: colors.bg },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
