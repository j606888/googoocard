import crypto from "crypto";

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET ?? "";
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const LOGIN_CHANNEL_ID = process.env.LINE_LOGIN_CHANNEL_ID ?? "";
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? "";
const PUBLIC_WEB_URL = process.env.NEXT_PUBLIC_PUBLIC_WEB_URL ?? "";
const HOST_URL = process.env.NEXT_PUBLIC_HOST_URL ?? "";

const OA_ID = process.env.NEXT_PUBLIC_LINE_OA_ID ?? "";

/** Generate a URL-safe random key used to bind a website account to a LINE user. */
export function generateRandomKey(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Build a LINE deep link that opens the official-account chat with `key`
 * pre-filled as the message. Sending it triggers the webhook binding.
 * Returns null if the OA id isn't configured.
 */
export function bindDeepLink(key: string): string | null {
  if (!OA_ID) return null;
  return `https://line.me/R/oaMessage/${OA_ID}/?${encodeURIComponent(key)}`;
}

/**
 * Where the "進入網站" button sends the user:
 * LIFF (auto-login) if configured, else the public tunnel URL, else the host URL.
 */
export function websiteEntryUrl(): string {
  if (LIFF_ID) return `https://liff.line.me/${LIFF_ID}`;
  return PUBLIC_WEB_URL || HOST_URL;
}

/**
 * Verify the `x-line-signature` header against the raw request body.
 * LINE signs the body with HMAC-SHA256 using the channel secret (base64).
 * See: https://developers.line.biz/en/reference/messaging-api/#signature-validation
 */
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !CHANNEL_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", CHANNEL_SECRET)
    .update(rawBody)
    .digest("base64");
  // timingSafeEqual requires equal-length buffers
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** A LINE message object (text or flex). Kept loose — LINE's flex schema is large. */
export type LineMessage = Record<string, unknown>;

/** A text message shorthand. */
export function textMessage(text: string): LineMessage {
  return { type: "text", text };
}

/**
 * The bound-user menu: a single Flex bubble with one "進入網站" button.
 * More buttons can be added to the `contents` array later.
 */
export function buildMenuFlex(): LineMessage {
  return {
    type: "flex",
    altText: "googoocard 選單",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "googoocard", weight: "bold", size: "xl" },
          { type: "text", text: "選擇要做的事", size: "sm", color: "#888888" },
          {
            type: "button",
            style: "primary",
            color: "#7c3aed",
            action: { type: "uri", label: "進入網站", uri: websiteEntryUrl() },
          },
        ],
      },
    },
  };
}

/**
 * Reply to a LINE event using its short-lived replyToken.
 * https://developers.line.biz/en/reference/messaging-api/#send-reply-message
 */
export async function replyMessage(
  replyToken: string,
  messages: LineMessage[],
): Promise<void> {
  if (!CHANNEL_ACCESS_TOKEN) {
    console.warn("[line] LINE_CHANNEL_ACCESS_TOKEN not set; skipping reply");
    return;
  }
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) {
    console.error(`[line] reply failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Verify a LIFF-issued ID token with LINE and return the LINE userId (`sub`).
 * Returns null if the token is invalid or doesn't match our login channel.
 * https://developers.line.biz/en/reference/line-login/#verify-id-token
 */
export async function verifyIdToken(idToken: string): Promise<{ userId: string } | null> {
  if (!idToken || !LOGIN_CHANNEL_ID) return null;
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: LOGIN_CHANNEL_ID }),
  });
  if (!res.ok) {
    console.error(`[line] verifyIdToken failed: ${res.status} ${await res.text()}`);
    return null;
  }
  const payload = (await res.json()) as { sub?: string };
  return payload.sub ? { userId: payload.sub } : null;
}

/** Minimal subset of the LINE webhook event shape we care about. */
export interface LineWebhookEvent {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string; groupId?: string; roomId?: string };
  message?: { type: string; id: string; text?: string };
}
