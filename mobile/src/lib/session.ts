// 登入狀態。token 存在 Keychain（expo-secure-store）；App 跟它的 WebView 共用伺服器上的
// User.currentClassroomId 當「目前的教室」，切換教室後 bump `epoch` 讓所有 WebView 重新進站。
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

import { api, apiFetch, ApiError, setApiToken } from './api';
import { API_URL, GOOGLE_IOS_CLIENT_ID } from './config';

const TOKEN_KEY = 'auth-token';

type State = {
  status: 'loading' | 'signedOut' | 'signedIn';
  token: string | null;
  // 換教室、重新登入時 +1，WebView 用它當 key 重新載入
  epoch: number;
};

let state: State = { status: 'loading', token: null, epoch: 0 };
const listeners = new Set<() => void>();
const signOutHooks = new Set<() => Promise<void>>();

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useSession(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export const currentToken = () => state.token;

// 教室範圍的 API 回 401 不一定是 token 壞了：也可能是剛被移出唯一的教室（帳號還在）。
// 用不需要教室的 /api/app/token 確認一次，真的失效才登出
let checking = false;
async function handleUnauthorized() {
  if (checking || !state.token) return;
  checking = true;
  try {
    const res = await fetch(`${API_URL}/api/app/token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.token}` },
      credentials: 'omit',
    });
    if (res.status === 401) await signOut();
  } catch {
    // 沒網路：先不動
  } finally {
    checking = false;
  }
}

async function setToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  setApiToken(token, () => void handleUnauthorized());
  setState({ status: 'signedIn', token, epoch: state.epoch + 1 });
}

// App 啟動時呼叫：讀 Keychain 的 token，順便換一張新的（一個月內有打開 App 就不會被登出）
export async function restoreSession(): Promise<void> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) {
    setState({ status: 'signedOut' });
    return;
  }
  setApiToken(token, () => void handleUnauthorized());
  setState({ status: 'signedIn', token });
  try {
    const { token: fresh } = await api<{ token: string }>('/api/app/token', { method: 'POST' });
    await SecureStore.setItemAsync(TOKEN_KEY, fresh);
    setApiToken(fresh);
    state = { ...state, token: fresh };
  } catch {
    // 沒網路就先用舊的；401 的話 api.ts 已經觸發登出
  }
}

export type LoginError =
  | 'EMAIL_NOT_FOUND'
  | 'INVALID_PASSWORD'
  | 'SOCIAL_ONLY'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'UNKNOWN';

export async function signIn(email: string, password: string): Promise<LoginError | null> {
  try {
    const { token } = await api<{ token: string }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password }),
    });
    await setToken(token);
    return null;
  } catch (e) {
    if (e instanceof ApiError) {
      const code = (e.body as { code?: string } | null)?.code;
      if (
        code === 'EMAIL_NOT_FOUND' ||
        code === 'INVALID_PASSWORD' ||
        code === 'SOCIAL_ONLY' ||
        code === 'RATE_LIMITED'
      )
        return code;
      return 'UNKNOWN';
    }
    return 'NETWORK';
  }
}

// Google／Apple 登入：拿到 ID token 交給 /api/auth/oauth（沒有帳號會直接建一個）。
// 使用者自己取消回 'CANCELED'，畫面不用顯示錯誤
async function oauthSignIn(
  provider: 'google' | 'apple',
  idToken: string,
  name?: string,
): Promise<LoginError | null> {
  try {
    const { token } = await api<{ token: string }>('/api/auth/oauth', {
      method: 'POST',
      body: JSON.stringify({ provider, idToken, name }),
    });
    await setToken(token);
    return null;
  } catch (e) {
    return e instanceof ApiError ? 'UNKNOWN' : 'NETWORK';
  }
}

export async function signInWithApple(): Promise<LoginError | 'CANCELED' | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) return 'UNKNOWN';
    // 名字只有第一次授權時給
    const n = credential.fullName;
    const name = [n?.familyName, n?.givenName].filter(Boolean).join('') || undefined;
    return await oauthSignIn('apple', credential.identityToken, name);
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return 'CANCELED';
    return 'UNKNOWN';
  }
}

GoogleSignin.configure({ iosClientId: GOOGLE_IOS_CLIENT_ID });

export async function signInWithGoogle(): Promise<LoginError | 'CANCELED' | null> {
  try {
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success' || !res.data.idToken) return 'CANCELED';
    return await oauthSignIn('google', res.data.idToken);
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) return 'CANCELED';
    return 'UNKNOWN';
  }
}

// 登出前要做的事（例如刪除這支手機的推播 token），要在 token 還有效時跑
export function onSignOut(hook: () => Promise<void>) {
  signOutHooks.add(hook);
}

let signingOut = false;
export async function signOut(): Promise<void> {
  if (signingOut || state.status !== 'signedIn') return;
  signingOut = true;
  try {
    await Promise.all([...signOutHooks].map((h) => h().catch(() => {})));
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    // 下次按 Google 登入時要能選別的帳號
    await GoogleSignin.signOut().catch(() => {});
    setApiToken(null);
    setState({ status: 'signedOut', token: null, epoch: state.epoch + 1 });
  } finally {
    signingOut = false;
  }
}

// 換教室：伺服器更新 User.currentClassroomId，App 這邊重新載入所有 WebView
export async function switchClassroom(classroomId: number): Promise<void> {
  await api(`/api/classrooms/${classroomId}/switch`, { method: 'POST', body: '{}' });
  bumpEpoch();
}

export function bumpEpoch() {
  setState({ epoch: state.epoch + 1 });
}

// 刪除帳號：成功就登出。還擁有教室會丟 ApiError(409)，body 有 classrooms
export async function deleteAccount(): Promise<void> {
  const res = await apiFetch('/api/me', { method: 'DELETE' });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  await signOut();
}
