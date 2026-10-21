// Sign in with Apple 的伺服器端：把登入時拿到的 authorization code 換成 refresh token，
// 刪帳號時再用它向 Apple 撤銷授權（App Store Guideline 5.1.1(v)）。
// 需要 Apple Developer 的 Sign in with Apple 金鑰：APPLE_TEAM_ID、APPLE_KEY_ID、
// APPLE_PRIVATE_KEY（.p8 的內容）。沒設就整個跳過——登入照常，只是刪帳號時不會撤銷。
import { importPKCS8, SignJWT } from "jose";

const APPLE = "https://appleid.apple.com";

export function appleRevokeConfigured() {
  return Boolean(process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY);
}

// client_secret 是一張用 .p8 簽的短效 JWT，sub 必須是發出 code 的那個 client
async function clientSecret(clientId: string) {
  // Vercel 的環境變數常把換行存成字面的 \n
  const pem = process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID! })
    .setIssuer(process.env.APPLE_TEAM_ID!)
    .setSubject(clientId)
    .setAudience(APPLE)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

/** 失敗回 null（不擋登入）。code 只能用一次、五分鐘內有效。 */
export async function exchangeAppleCode(code: string, clientId: string): Promise<string | null> {
  if (!appleRevokeConfigured()) return null;
  try {
    const res = await fetch(`${APPLE}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: await clientSecret(clientId),
        code,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) {
      console.error("[apple] token exchange failed", res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as { refresh_token?: string };
    return data.refresh_token ?? null;
  } catch (error) {
    console.error("[apple] token exchange error", error);
    return null;
  }
}

/** 失敗只記 log，不擋刪帳號。 */
export async function revokeAppleToken(refreshToken: string, clientId: string): Promise<boolean> {
  if (!appleRevokeConfigured()) return false;
  try {
    const res = await fetch(`${APPLE}/auth/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: await clientSecret(clientId),
        token: refreshToken,
        token_type_hint: "refresh_token",
      }),
    });
    if (!res.ok) console.error("[apple] revoke failed", res.status, await res.text());
    return res.ok;
  } catch (error) {
    console.error("[apple] revoke error", error);
    return false;
  }
}
