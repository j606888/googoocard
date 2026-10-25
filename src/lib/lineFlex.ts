import {
  BRAND,
  BRAND_DARK,
  BRAND_SUBTLE,
  ROW_DIVIDER,
  TEXT_MAIN,
  TEXT_MUTED,
  WARNING,
  type LineMessage,
} from "@/lib/line";
import { formatMoney } from "@/lib/money";
import { toTaipeiDateKey } from "@/lib/taipei-date";

/**
 * 聊天室裡直接回的卡片（課表／價目表／我的課卡）。Pure builders over plain data —
 * the queries live in src/service/lineBot.ts — so the shapes are unit-tested
 * without a DB. Flex spec: https://developers.line.biz/en/reference/messaging-api/#flex-message
 */

/** Rows per day bubble before it says「還有 N 堂」— keeps the carousel well under LINE's size limit. */
export const MAX_ROWS_PER_DAY = 8;
/** LINE caps a carousel at 12 bubbles. */
const MAX_BUBBLES = 12;

const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

const taipeiParts = (d: Date) => {
  const t = new Date(d.getTime() + TAIPEI_OFFSET_MS);
  return {
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate(),
    weekday: t.getUTCDay(),
    hhmm: `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`,
  };
};

/** 「10/27（二）」 */
export const taipeiDayLabel = (d: Date) => {
  const p = taipeiParts(d);
  return `${p.month}/${p.day}（${WEEKDAY[p.weekday]}）`;
};

// ── 課表 ────────────────────────────────────────────────────────────────────

export type SchedulePeriod = {
  startTime: Date;
  endTime: Date;
  lessonName: string;
  /** 「Bachata · 中階」 */
  styleLabel: string;
  teacherNames: string[];
  locationName: string | null;
};

export type ScheduleDay = { dateKey: string; label: string; periods: SchedulePeriod[] };

/** Periods grouped by Taipei calendar day, in time order. */
export function groupByTaipeiDay(periods: SchedulePeriod[]): ScheduleDay[] {
  const days = new Map<string, ScheduleDay>();
  for (const p of [...periods].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())) {
    const dateKey = toTaipeiDateKey(p.startTime);
    if (!days.has(dateKey)) days.set(dateKey, { dateKey, label: taipeiDayLabel(p.startTime), periods: [] });
    days.get(dateKey)!.periods.push(p);
  }
  return [...days.values()];
}

const header = (title: string, subtitle: string): LineMessage => ({
  type: "box",
  layout: "vertical",
  backgroundColor: BRAND,
  paddingAll: "lg",
  spacing: "xs",
  contents: [
    { type: "text", text: title, weight: "bold", size: "lg", color: "#ffffff", wrap: true },
    { type: "text", text: subtitle, size: "xs", color: BRAND_SUBTLE, wrap: true },
  ],
});

const uriButton = (label: string, uri: string, primary = false): LineMessage => ({
  type: "button",
  style: primary ? "primary" : "secondary",
  color: primary ? BRAND : undefined,
  height: "sm",
  action: { type: "uri", label, uri },
});

const footer = (buttons: LineMessage[]): LineMessage | undefined =>
  buttons.length
    ? { type: "box", layout: "vertical", spacing: "sm", paddingAll: "md", contents: buttons }
    : undefined;

function periodRow(p: SchedulePeriod, showLocation: boolean): LineMessage {
  const meta = [p.styleLabel, p.teacherNames.join("、"), showLocation ? p.locationName : null]
    .filter(Boolean)
    .join(" · ");
  return {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    paddingTop: "md",
    paddingBottom: "md",
    contents: [
      {
        type: "text",
        text: taipeiParts(p.startTime).hhmm,
        flex: 0,
        size: "sm",
        weight: "bold",
        color: BRAND_DARK,
      },
      {
        type: "box",
        layout: "vertical",
        flex: 1,
        contents: [
          { type: "text", text: p.lessonName, size: "sm", weight: "bold", color: TEXT_MAIN, wrap: true },
          ...(meta ? [{ type: "text", text: meta, size: "xs", color: TEXT_MUTED, wrap: true }] : []),
        ],
      },
    ],
  };
}

/**
 * 未來一週課表：一天一張卡（carousel）。`locationName` = filtered to one 分部 (rows
 * then omit it); null = every location, each row names its own.
 */
export function scheduleCarousel(opts: {
  classroomName: string;
  locationName: string | null;
  days: ScheduleDay[];
  /** Google Maps link for the filtered location, when it has an address. */
  mapUri?: string | null;
}): LineMessage {
  const title = opts.locationName ? `${opts.locationName} 課表` : "課表";
  if (opts.days.length === 0) {
    return { type: "text", text: `${opts.classroomName}${opts.locationName ? `（${opts.locationName}）` : ""}未來一週沒有排課。` };
  }
  const bubbles = opts.days.slice(0, MAX_BUBBLES).map((day) => {
    const shown = day.periods.slice(0, MAX_ROWS_PER_DAY);
    const rows: LineMessage[] = [];
    shown.forEach((p, i) => {
      if (i > 0) rows.push({ type: "separator", color: ROW_DIVIDER });
      rows.push(periodRow(p, !opts.locationName));
    });
    const hidden = day.periods.length - shown.length;
    if (hidden > 0) {
      rows.push({ type: "text", text: `還有 ${hidden} 堂`, size: "xs", color: TEXT_MUTED, margin: "md" });
    }
    const actions = footer(opts.mapUri ? [uriButton("地圖", opts.mapUri)] : []);
    return {
      type: "bubble",
      size: "kilo",
      header: header(day.label, `${opts.classroomName} · ${title}`),
      body: { type: "box", layout: "vertical", paddingAll: "lg", paddingTop: "sm", contents: rows },
      ...(actions ? { footer: actions } : {}),
    };
  });
  return {
    type: "flex",
    altText: `${opts.classroomName} ${title}（未來一週）`,
    contents: { type: "carousel", contents: bubbles },
  };
}

/** Google Maps search link for an address (opens the Maps app on phones). */
export const mapsUri = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

// ── 價目表 ──────────────────────────────────────────────────────────────────

export type PriceCard = { name: string; sessions: number; price: number };
export type PriceGroup = { title: string; note?: string; cards: PriceCard[] };

function priceRow(card: PriceCard): LineMessage {
  const perSession = card.sessions > 1 ? ` · 單堂 $${formatMoney(Math.round(card.price / card.sessions))}` : "";
  return {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    paddingTop: "md",
    paddingBottom: "md",
    contents: [
      {
        type: "box",
        layout: "vertical",
        flex: 1,
        contents: [
          { type: "text", text: card.name, size: "sm", weight: "bold", color: TEXT_MAIN, wrap: true },
          { type: "text", text: `${card.sessions} 堂${perSession}`, size: "xs", color: TEXT_MUTED },
        ],
      },
      {
        type: "text",
        text: card.price === 0 ? "免費" : `$${formatMoney(card.price)}`,
        flex: 0,
        size: "md",
        weight: "bold",
        color: BRAND_DARK,
        gravity: "center",
      },
    ],
  };
}

/** 價目表：一組一張卡（通用課卡／各舞種複習卡／體驗課）。 */
export function priceListFlex(opts: {
  classroomName: string;
  groups: PriceGroup[];
  /** Bound students get a 購買課卡 button (LIFF). */
  buyUri?: string | null;
}): LineMessage {
  const groups = opts.groups.filter((g) => g.cards.length > 0).slice(0, MAX_BUBBLES);
  if (groups.length === 0) return { type: "text", text: `${opts.classroomName}目前沒有公開的課卡。` };
  const bubbles = groups.map((group) => {
    const rows: LineMessage[] = [];
    group.cards.forEach((card, i) => {
      if (i > 0) rows.push({ type: "separator", color: ROW_DIVIDER });
      rows.push(priceRow(card));
    });
    if (group.note) rows.push({ type: "text", text: group.note, size: "xs", color: TEXT_MUTED, wrap: true, margin: "md" });
    const actions = footer(opts.buyUri ? [uriButton("購買課卡", opts.buyUri, true)] : []);
    return {
      type: "bubble",
      size: "kilo",
      header: header(group.title, `${opts.classroomName} · 價目表`),
      body: { type: "box", layout: "vertical", paddingAll: "lg", paddingTop: "sm", contents: rows },
      ...(actions ? { footer: actions } : {}),
    };
  });
  return {
    type: "flex",
    altText: `${opts.classroomName} 價目表`,
    contents: bubbles.length === 1 ? bubbles[0] : { type: "carousel", contents: bubbles },
  };
}

// ── 我的課卡 ────────────────────────────────────────────────────────────────

export type MyCard = {
  name: string;
  serial: string;
  remainingSessions: number;
  totalSessions: number;
  /** Set when unpaid — the amount still owed. */
  unpaidAmount: number | null;
};

function myCardRow(card: MyCard): LineMessage {
  const exhausted = card.remainingSessions <= 0;
  return {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    paddingTop: "md",
    paddingBottom: "md",
    contents: [
      {
        type: "box",
        layout: "vertical",
        flex: 1,
        contents: [
          { type: "text", text: card.name, size: "sm", weight: "bold", color: TEXT_MAIN, wrap: true },
          {
            type: "text",
            text: card.unpaidAmount !== null ? `${card.serial} · 未付 $${formatMoney(card.unpaidAmount)}` : card.serial,
            size: "xs",
            color: card.unpaidAmount !== null ? WARNING : TEXT_MUTED,
          },
        ],
      },
      {
        type: "text",
        text: exhausted ? "已用完" : `剩 ${card.remainingSessions}／${card.totalSessions} 堂`,
        flex: 0,
        size: "sm",
        weight: "bold",
        color: exhausted ? TEXT_MUTED : BRAND_DARK,
        gravity: "center",
      },
    ],
  };
}

export function myCardsFlex(opts: {
  studentName: string;
  classroomName: string;
  cards: MyCard[];
  cardsUri: string;
  buyUri: string;
  /** Bound to more than one student → offer the LIFF picker. */
  switchUri?: string | null;
}): LineMessage {
  const rows: LineMessage[] = [];
  if (opts.cards.length === 0) {
    rows.push({ type: "text", text: "目前沒有可以用的課卡。", size: "sm", color: TEXT_MAIN, wrap: true });
  }
  opts.cards.forEach((card, i) => {
    if (i > 0) rows.push({ type: "separator", color: ROW_DIVIDER });
    rows.push(myCardRow(card));
  });
  const owed = opts.cards.reduce((sum, c) => sum + (c.unpaidAmount ?? 0), 0);
  if (owed > 0) {
    rows.push({
      type: "text",
      text: `尚未付款 $${formatMoney(owed)}，上課時請找小幫手付款。`,
      size: "xs",
      color: WARNING,
      wrap: true,
      margin: "md",
    });
  }
  const buttons = [
    uriButton(opts.cards.length === 0 ? "購買課卡" : "續卡／購買", opts.buyUri, true),
    uriButton("查看全部課卡", opts.cardsUri),
    ...(opts.switchUri ? [uriButton("切換學生", opts.switchUri)] : []),
  ];
  return {
    type: "flex",
    altText: `${opts.studentName} 的課卡`,
    contents: {
      type: "bubble",
      size: "mega",
      header: header(`${opts.studentName} 的課卡`, opts.classroomName),
      body: { type: "box", layout: "vertical", paddingAll: "lg", paddingTop: "sm", contents: rows },
      footer: footer(buttons),
    },
  };
}

// ── Quick replies ───────────────────────────────────────────────────────────

export type QuickChoice = { label: string; data: string; displayText?: string };

/** A text message with tappable chips under it (LINE quick reply, max 13). */
export function quickReplyText(text: string, choices: QuickChoice[]): LineMessage {
  return {
    type: "text",
    text,
    quickReply: {
      items: choices.slice(0, 13).map((c) => ({
        type: "action",
        action: {
          type: "postback",
          // Quick-reply labels are capped at 20 chars.
          label: c.label.slice(0, 20),
          data: c.data,
          displayText: c.displayText ?? c.label,
        },
      })),
    },
  };
}
