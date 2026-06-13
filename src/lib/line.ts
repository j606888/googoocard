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

// Postback `data` values for the menu identity-switch buttons.
export const SWITCH_TO_STUDENT = "switch=student";
export const SWITCH_TO_TEACHER = "switch=teacher";

/** The shared "進入網站" button used by the teacher menu. */
function websiteButton(): LineMessage {
  return {
    type: "button",
    style: "primary",
    color: "#7c3aed",
    action: { type: "uri", label: "進入網站", uri: websiteEntryUrl() },
  };
}

/**
 * URL for a student LIFF sub-page (`/liff/<path>`): a LIFF deep link when the
 * LIFF id is configured (opens in-app, auto ID-token auth), else a plain URL.
 */
export function liffPath(path: string): string {
  if (LIFF_ID) return `https://liff.line.me/${LIFF_ID}/${path}`;
  const base = PUBLIC_WEB_URL || HOST_URL;
  return base ? `${base}/liff/${path}` : `/liff/${path}`;
}

/** A button that opens a student LIFF sub-page. */
function liffButton(
  label: string,
  path: string,
  style: "primary" | "secondary" = "primary",
): LineMessage {
  return {
    type: "button",
    style,
    ...(style === "primary" ? { color: "#7c3aed" } : {}),
    action: { type: "uri", label, uri: liffPath(path) },
  };
}

/** A secondary postback button used to switch between teacher/student menus. */
function switchButton(label: string, data: string): LineMessage {
  return {
    type: "button",
    style: "secondary",
    action: { type: "postback", label, data },
  };
}

function menuBubble(subtitle: string, buttons: LineMessage[]): LineMessage {
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "googoocard", weight: "bold", size: "xl" },
        { type: "text", text: subtitle, size: "sm", color: "#888888" },
        ...buttons,
      ],
    },
  };
}

/**
 * The teacher menu. Pass `showSwitch` when this LINE account is also bound to a
 * student, to expose a "切換到學生" button.
 */
export function buildMenuFlex(opts: { showSwitch?: boolean } = {}): LineMessage {
  const buttons = [websiteButton()];
  if (opts.showSwitch) buttons.push(switchButton("切換到學生", SWITCH_TO_STUDENT));
  return {
    type: "flex",
    altText: "googoocard 老師選單",
    contents: menuBubble("老師選單", buttons),
  };
}

/**
 * The student menu. Pass `showSwitch` when this LINE account is also a teacher,
 * to expose a "切換到老師" button; pass `showStudentSwitch` when the account is
 * bound to more than one student, to expose a "切換學生" button that opens the
 * LIFF identity picker.
 */
export function buildStudentMenuFlex(
  opts: { showSwitch?: boolean; showStudentSwitch?: boolean; name?: string } = {},
): LineMessage {
  const buttons = [
    liffButton("上課簽到", "checkin"),
    liffButton("瀏覽我的課卡", "cards"),
    liffButton("購買課卡", "buy"),
  ];
  if (opts.showStudentSwitch)
    buttons.push(liffButton("切換學生", "cards?switch=1", "secondary"));
  if (opts.showSwitch) buttons.push(switchButton("切換到老師", SWITCH_TO_TEACHER));
  return {
    type: "flex",
    altText: "googoocard 學生選單",
    contents: menuBubble(opts.name ? `${opts.name} 的學生選單` : "學生選單", buttons),
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
  postback?: { data: string };
}
