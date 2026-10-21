// 打伺服器的 API。登入後帶 bearer token（session.ts 存的）；伺服器那邊見 src/lib/auth.ts 的 generateAppToken
import { API_URL } from './config';

// 沒有網路、伺服器連不上
export class NetworkError extends Error {
  constructor() {
    super('沒有網路');
  }
}

// 伺服器回了錯誤（4xx／5xx）。body 是伺服器回傳的 JSON（例如 { code: 'OWNS_CLASSROOMS', ... }）
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API ${status}`);
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

// session.ts 設的：目前的 token，和 token 失效（401）時要做什麼
export function setApiToken(value: string | null, unauthorized?: () => void) {
  token = value;
  if (unauthorized) onUnauthorized = unauthorized;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('X-Googoocard-Client', 'app');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'omit' });
  } catch {
    throw new NetworkError();
  }
  // token 過期、被移出教室後又沒有其他教室、帳號被刪：交給 session 決定要不要登出
  if (res.status === 401 && token) onUnauthorized?.();
  return res;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
