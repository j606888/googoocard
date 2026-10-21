// Google／Apple 登入：驗證用戶端拿到的 ID token（JWT），用對方公開的 JWKS 驗簽。
// 網頁和 App 都只把 ID token 傳上來，伺服器不碰 OAuth code，也就不需要 client secret。
import { createRemoteJWKSet, jwtVerify } from "jose";

export type OAuthProvider = "google" | "apple";

export type OAuthIdentity = {
  sub: string;
  email: string;
  /** The client the token was issued to (Apple: bundle ID or Services ID). */
  audience: string;
};

const PROVIDERS = {
  google: {
    jwks: createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")),
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    // 網頁的 client ID 和 iOS 的 client ID 都要收（App 拿到的 token aud 是 iOS 的）
    audienceEnv: "GOOGLE_CLIENT_IDS",
  },
  apple: {
    jwks: createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys")),
    issuer: ["https://appleid.apple.com"],
    // App 的 bundle ID（原生登入）和網頁的 Services ID
    audienceEnv: "APPLE_CLIENT_IDS",
  },
} as const;

export function oauthAudiences(provider: OAuthProvider): string[] {
  return (process.env[PROVIDERS[provider].audienceEnv] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 驗不過（簽章、issuer、audience、過期、email 沒驗證）一律回 null。 */
export async function verifyIdToken(
  provider: OAuthProvider,
  idToken: string
): Promise<OAuthIdentity | null> {
  const audience = oauthAudiences(provider);
  if (audience.length === 0) return null;
  const { jwks, issuer } = PROVIDERS[provider];
  try {
    const { payload } = await jwtVerify(idToken, jwks, { issuer: [...issuer], audience });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    // Apple 的 email_verified 是字串 "true"；Google 是布林
    const verified = payload.email_verified === true || payload.email_verified === "true";
    if (!payload.sub || !email || !verified) return null;
    const aud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
    return { sub: payload.sub, email, audience: aud ?? "" };
  } catch {
    return null;
  }
}
