// WebView 怎麼進網站：第一個請求 POST /api/app/web-session，帶 App 的 bearer token，
// 伺服器設好網頁的 cookie 再 303 到 `path`（網頁版 src/app/api/app/web-session/route.ts）
import { API_URL } from './config';

export const USER_AGENT_SUFFIX = 'GoogoocardApp/1.0'; // 網頁版 src/lib/inApp.ts 認這個字串

export function webSessionSource(token: string, path: string) {
  return {
    uri: `${API_URL}/api/app/web-session?next=${encodeURIComponent(path)}`,
    method: 'POST' as const,
    headers: { Authorization: `Bearer ${token}` },
    body: '',
  };
}

// 網頁上標了 data-in-app 的元素：底部導覽、鈴鐺、切換教室在 App 裡是原生的，藏起來
export const INJECT_BEFORE_LOAD = `(function () {
  var style = document.createElement('style');
  style.textContent = '[data-in-app="hide"]{display:none!important}[data-in-app="no-bottom-pad"]{padding-bottom:0!important}';
  document.documentElement.appendChild(style);
})(); true;`;

export const isSameSite = (url: string) => url.startsWith(API_URL);

export function pathOf(url: string): string {
  return isSameSite(url) ? url.slice(API_URL.length) || '/' : url;
}
