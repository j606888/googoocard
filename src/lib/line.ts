import crypto from "crypto";
import { decodeMockToken, isLineMockEnabled, MOCK_TOKEN_PREFIX } from "@/lib/lineMock";

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

// Brand palette for the flex messages — the site's primary green
// (globals.css --color-primary-*), same as LIFF and the rich menu.
export const BRAND = "#2B8E6E"; // primary-700 (header background)
export const BRAND_SUBTLE = "#E3F7F0"; // primary-100, header subtitle on dark bg
export const BRAND_DARK = "#1B5E4A"; // primary-900
export const TEXT_MAIN = "#333333";
export const TEXT_MUTED = "#9ca3af";
export const ROW_DIVIDER = "#f0f0f0";
export const WARNING = "#C96C1E"; // warning-800

/**
 * A single tappable menu entry. Rendered as an icon-row (emoji + label + ›) with
 * the action bound to the whole row, instead of a filled LINE button — cleaner
 * and lets us show a leading icon, which LINE's native `button` can't.
 */
type MenuItem = { icon: string; label: string; action: LineMessage; muted?: boolean; note?: string };

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

/** Render one menu entry as a tappable horizontal row: icon · label (· note under it) · chevron. */
function itemRow(item: MenuItem): LineMessage {
  const label = { type: "text", text: item.label, size: "md", weight: "bold", color: item.muted ? TEXT_MUTED : TEXT_MAIN };
  return {
    type: "box",
    layout: "horizontal",
    action: item.action,
    paddingAll: "md",
    spacing: "md",
    contents: [
      { type: "text", text: item.icon, flex: 0, size: "lg", gravity: "center" },
      item.note
        ? {
            type: "box",
            layout: "vertical",
            flex: 1,
            contents: [label, { type: "text", text: item.note, size: "xs", color: TEXT_MUTED, wrap: true }],
          }
        : { ...label, flex: 1, gravity: "center" },
      { type: "text", text: "›", flex: 0, size: "lg", gravity: "center", color: "#cccccc" },
    ],
  };
}

/**
 * A branded menu bubble: a purple header with the brand + a subtitle, a body of
 * icon-rows (separated by hairlines), and a small footer hint.
 *
 * `lead` prepends a wrapped paragraph above the rows — used by messages that
 * need to say something before offering the action (e.g. the renewal reminder).
 */
function menuBubble(
  subtitle: string,
  items: MenuItem[],
  opts: { lead?: string } = {},
): LineMessage {
  const rows: LineMessage[] = [];
  if (opts.lead) {
    rows.push({
      type: "box",
      layout: "vertical",
      paddingAll: "lg",
      contents: [
        { type: "text", text: opts.lead, wrap: true, size: "sm", color: TEXT_MAIN },
      ],
    });
    rows.push({ type: "separator", color: ROW_DIVIDER });
  }
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
 * The student menu, sent when a bound student types something the bot doesn't
 * recognise (the rich menu does the same job). `showStudentSwitch` when the account
 * is bound to more than one student — usually one per classroom — exposes
 * 「切換教室」, which opens the LIFF picker.
 */
export function buildStudentMenuFlex(opts: { showStudentSwitch?: boolean; name?: string } = {}): LineMessage {
  const items = [
    liffItem("📝", "上課簽到", "checkin"),
    liffItem("🎫", "我的課卡", "cards"),
    liffItem("📅", "課表", "schedule"),
    liffItem("🛒", "課卡方案", "plans"),
  ];
  if (opts.showStudentSwitch) items.push(liffItem("🔁", "切換教室", "cards?switch=1", true));
  return {
    type: "flex",
    altText: "googoocard 學生選單",
    contents: menuBubble(opts.name ? `${opts.name} 的學生選單` : "學生選單", items),
  };
}

/**
 * Rich menu「更多」. The rich menu is shared by everyone, so this is where it
 * differs by who taps it: a bound student gets their own things (上課紀錄,
 * 教室地點, 切換教室 when bound in several classrooms); an unbound account gets
 * the two ways to become a student.
 */
export function buildMoreMenuFlex(opts: {
  /** Bound → their menu (header names them); omitted → the unbound one. */
  student?: { name: string; classroomName: string; monthAttendance: number };
  /** 分部 of the classroom in view; empty → no 教室地點 row. */
  locationNames?: string[];
  /** Bound to more than one student (one per classroom) → the LIFF picker. */
  studentSwitch?: boolean;
  /** Not a bound student and several classrooms are public → choose one. */
  classroomSwitch?: boolean;
}): LineMessage {
  const bindHelp = { type: "postback", label: "怎麼綁定", data: "a=bindhelp", displayText: "怎麼綁定學生身分？" };
  const locations: MenuItem[] = opts.locationNames?.length
    ? [
        {
          icon: "📍",
          label: "教室地點",
          note: opts.locationNames.join("・"),
          action: { type: "postback", label: "教室地點", data: "a=locations", displayText: "教室地點" },
        },
      ]
    : [];

  if (opts.student) {
    const { name, classroomName, monthAttendance } = opts.student;
    const items: MenuItem[] = [
      {
        ...liffItem("🗓", "上課紀錄", "cards?tab=attend"),
        note: monthAttendance > 0 ? `這個月上了 ${monthAttendance} 堂` : "你上過的每一堂課",
      },
      ...locations,
    ];
    if (opts.studentSwitch) items.push(liffItem("🔁", "切換教室", "cards?switch=1"));
    items.push({ icon: "🔗", label: "也在別間教室上課？", muted: true, action: bindHelp });
    return { type: "flex", altText: "googoocard 更多", contents: menuBubble(`${name} · ${classroomName}`, items) };
  }

  const items: MenuItem[] = [
    { ...liffItem("📷", "第一次來上課", "checkin"), note: "到教室掃門口的簽到 QR 就能登記" },
    { icon: "🔗", label: "已經在上課了", note: "請老師傳綁定連結給你", action: bindHelp },
    ...locations,
  ];
  if (opts.classroomSwitch) {
    items.push({ icon: "🔁", label: "切換教室", action: { type: "postback", label: "切換教室", data: "a=classrooms", displayText: "切換教室" } });
  }
  return {
    type: "flex",
    altText: "googoocard 更多",
    contents: menuBubble("還沒綁定學生身分", items, {
      lead: "要簽到、看自己的課卡，先綁定學生身分。課表和價目表不用綁定也能看。",
    }),
  };
}

/**
 * The 續卡提醒 push: tells the student which card ran out and offers a one-tap
 * route to the LIFF purchase page. Same branded bubble as the menus.
 */
export function buildRenewalReminderFlex(opts: {
  name?: string;
  cardName?: string;
}): LineMessage {
  const card = opts.cardName ? `《${opts.cardName}》` : "課卡";
  return {
    type: "flex",
    altText: "續卡提醒",
    contents: menuBubble("續卡提醒", [liffItem("🛒", "購買課卡", "plans")], {
      lead: `${opts.name ? `${opts.name}，你` : "你"}的${card}堂數已經用完囉！要繼續上課的話，點下面就能直接續卡 👇`,
    }),
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
 * Push a message to a LINE user without a replyToken (we initiate, not the user).
 * https://developers.line.biz/en/reference/messaging-api/#send-push-message
 *
 * Returns whether LINE accepted it. Unlike `replyMessage` this also catches the
 * `fetch` itself: the renewal-reminder cron loops over many students and must not
 * abort the batch on one network blip. Still never throws — outbound failures are
 * swallowed, per the convention. The caller uses the boolean to decide whether to
 * record the send (a failed push must not burn the cooldown).
 */
export async function pushMessage(
  to: string,
  messages: LineMessage[],
): Promise<boolean> {
  if (!CHANNEL_ACCESS_TOKEN) {
    console.warn("[line] LINE_CHANNEL_ACCESS_TOKEN not set; skipping push");
    return false;
  }
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ to, messages }),
    });
    if (!res.ok) {
      console.error(`[line] push failed: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[line] push threw", e);
    return false;
  }
}

/**
 * Verify a LIFF-issued ID token with LINE and return the LINE userId (`sub`),
 * plus the display name / picture when the LIFF app has the `profile` scope
 * (used to pre-fill a newcomer's nickname and avatar).
 * Returns null if the token is invalid or doesn't match our login channel.
 * https://developers.line.biz/en/reference/line-login/#verify-id-token
 */
export async function verifyIdToken(
  idToken: string
): Promise<{ userId: string; name?: string; picture?: string } | null> {
  // /dev/line simulator tokens: accepted only in mock mode, never sent to LINE.
  if (idToken?.startsWith(MOCK_TOKEN_PREFIX)) {
    return isLineMockEnabled() ? decodeMockToken(idToken) : null;
  }
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
  const payload = (await res.json()) as { sub?: string; name?: string; picture?: string };
  return payload.sub
    ? { userId: payload.sub, name: payload.name, picture: payload.picture }
    : null;
}

/** Minimal subset of the LINE webhook event shape we care about. */
export interface LineWebhookEvent {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string; groupId?: string; roomId?: string };
  message?: { type: string; id: string; text?: string };
  postback?: { data: string };
}
