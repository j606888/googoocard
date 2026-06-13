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

// Brand palette for the flex menus.
const BRAND = "#7c3aed"; // primary purple (header background)
const BRAND_SUBTLE = "#e9d5ff"; // light purple for header subtitle on dark bg
const TEXT_MAIN = "#333333";
const TEXT_MUTED = "#9ca3af";
const ROW_DIVIDER = "#f0f0f0";

/**
 * A single tappable menu entry. Rendered as an icon-row (emoji + label + ›) with
 * the action bound to the whole row, instead of a filled LINE button — cleaner
 * and lets us show a leading icon, which LINE's native `button` can't.
 */
type MenuItem = { icon: string; label: string; action: LineMessage; muted?: boolean };

/** The shared "進入網站" entry used by the teacher menu. */
function websiteItem(): MenuItem {
  return {
    icon: "🖥️",
    label: "進入網站",
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

/** A menu entry that opens a student LIFF sub-page. */
function liffItem(icon: string, label: string, path: string, muted = false): MenuItem {
  return { icon, label, muted, action: { type: "uri", label, uri: liffPath(path) } };
}

/** A muted entry that switches between teacher/student menus via postback. */
function switchItem(label: string, data: string): MenuItem {
  return { icon: "🔄", label, muted: true, action: { type: "postback", label, data } };
}

/** Render one menu entry as a tappable horizontal row: icon · label · chevron. */
function itemRow(item: MenuItem): LineMessage {
  return {
    type: "box",
    layout: "horizontal",
    action: item.action,
    paddingAll: "md",
    spacing: "md",
    contents: [
      { type: "text", text: item.icon, flex: 0, size: "lg", gravity: "center" },
      {
        type: "text",
        text: item.label,
        flex: 1,
        size: "md",
        weight: "bold",
        gravity: "center",
        color: item.muted ? TEXT_MUTED : TEXT_MAIN,
      },
      { type: "text", text: "›", flex: 0, size: "lg", gravity: "center", color: "#cccccc" },
    ],
  };
}

/**
 * A branded menu bubble: a purple header with the brand + a subtitle, a body of
 * icon-rows (separated by hairlines), and a small footer hint.
 */
function menuBubble(subtitle: string, items: MenuItem[]): LineMessage {
  const rows: LineMessage[] = [];
  items.forEach((item, i) => {
    if (i > 0) rows.push({ type: "separator", color: ROW_DIVIDER });
    rows.push(itemRow(item));
  });
  return {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: BRAND,
      paddingAll: "lg",
      spacing: "xs",
      contents: [
        { type: "text", text: "googoocard", weight: "bold", size: "xl", color: "#ffffff" },
        { type: "text", text: subtitle, size: "sm", color: BRAND_SUBTLE },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "none",
      contents: rows,
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "md",
      contents: [
        {
          type: "text",
          text: "有問題隨時聯繫老師 💬",
          size: "xs",
          align: "center",
          color: TEXT_MUTED,
        },
      ],
    },
    styles: { footer: { separator: true } },
  };
}

/**
 * The teacher menu. Pass `showSwitch` when this LINE account is also bound to a
 * student, to expose a "切換到學生" button.
 */
export function buildMenuFlex(opts: { showSwitch?: boolean } = {}): LineMessage {
  const items = [websiteItem()];
  if (opts.showSwitch) items.push(switchItem("切換到學生", SWITCH_TO_STUDENT));
  return {
    type: "flex",
    altText: "googoocard 老師選單",
    contents: menuBubble("老師選單", items),
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
  const items = [
    liffItem("📝", "上課簽到", "checkin"),
    liffItem("🎫", "瀏覽我的課卡", "cards"),
    liffItem("🛒", "購買課卡", "buy"),
  ];
  if (opts.showStudentSwitch)
    items.push(liffItem("🔁", "切換學生", "cards?switch=1", true));
  if (opts.showSwitch) items.push(switchItem("切換到老師", SWITCH_TO_TEACHER));
  return {
    type: "flex",
    altText: "googoocard 學生選單",
    contents: menuBubble(opts.name ? `${opts.name} 的學生選單` : "學生選單", items),
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
