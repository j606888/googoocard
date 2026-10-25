/**
 * LINE 模擬器（/dev/line）的共用部分：不用 LINE Developers、不用手機，就能用
 * 不同的 LINE 身分走 LIFF 流程。只在 NEXT_PUBLIC_LINE_MOCK=1 且不是 Vercel
 * production 時開啟——production 就算誤設了變數也一律關閉。
 *
 * 假的 ID token 長這樣：`mock.<base64url(JSON {sub,name,picture})>`。
 * `verifyIdToken`（src/lib/line.ts）在模擬模式下直接解開它，不打 LINE API；
 * 模擬模式關閉時一律當成無效 token。
 *
 * Shared by server and client — no server-only imports here.
 */

export const MOCK_TOKEN_PREFIX = "mock.";
// The simulator sets the phone iframe's `name` to this prefix + the persona
// JSON. A frame's window.name survives navigation inside that frame, so the
// identity follows the student from /liff/checkin to /liff/buy without any
// shared storage (each phone frame keeps its own persona).
export const MOCK_FRAME_PREFIX = "line-mock:";
export const MOCK_CLOSE_MESSAGE = "line-mock:close";

export type MockLineUser = {
  userId: string;
  name: string;
  picture?: string;
  /** Simulator-only: what liff.getFriendship() answers. Not part of the token. */
  isFriend?: boolean;
};

export function isLineMockEnabled() {
  return (
    process.env.NEXT_PUBLIC_LINE_MOCK === "1" &&
    process.env.VERCEL_ENV !== "production" &&
    process.env.NEXT_PUBLIC_VERCEL_ENV !== "production"
  );
}

// UTF-8 safe base64url (names are Chinese); btoa/atob exist in browsers and Node 18+.
function toBase64Url(text: string) {
  const bytes = new TextEncoder().encode(text);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string) {
  const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function encodeMockToken(user: MockLineUser) {
  return MOCK_TOKEN_PREFIX + toBase64Url(JSON.stringify({ sub: user.userId, name: user.name, picture: user.picture }));
}

export function decodeMockToken(token: string): MockLineUser | null {
  if (!token.startsWith(MOCK_TOKEN_PREFIX)) return null;
  try {
    const payload = JSON.parse(fromBase64Url(token.slice(MOCK_TOKEN_PREFIX.length)));
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    return {
      userId: payload.sub,
      name: typeof payload.name === "string" ? payload.name : "",
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
    };
  } catch {
    return null;
  }
}

/** A fresh LINE userId for a 「全新的 LINE」 persona (real ones are U + 32 hex). */
export function newMockLineUserId() {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(14)), (b) => b.toString(16).padStart(2, "0")).join("");
  return `Umock${hex}`;
}
