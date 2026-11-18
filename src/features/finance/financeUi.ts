import type { BalanceFlow, PeriodWarning } from "@/store/slices/finance";

/** 每堂的提醒（不擋結清）。 */
export const WARNING_TEXT: Record<PeriodWarning, string> = {
  NO_LOCATION: "這門課沒有分部",
  NOT_STARTED: "分部還沒到轉換日，這堂不算錢",
  NOT_TAKEN: "還沒點名",
  NO_RULE: "這門課還沒設分帳規則",
  NO_CARD: "有人出席沒有卡、也沒付單堂",
  CARD_UNPAID: "有人的卡還沒付款",
  DROPIN_UNPAID: "有人的單堂還沒付",
  CARD_NO_BRANCH: "有卡沒指定錢的分部（先算這堂課的分部）",
  NO_PACK: "場地要用次數包，但還沒有包",
  NO_KEEPER: "這個分部還沒設負責人",
};

/** 錢還沒收齊：這幾種提醒在結清時要特別確認。 */
export const MONEY_WARNINGS: PeriodWarning[] = ["NO_CARD", "CARD_UNPAID", "DROPIN_UNPAID"];

export const REASON_TEXT: Record<BalanceFlow["reason"], string> = {
  teacher: "老師分攤",
  venue: "場地分攤",
  fund: "公積金",
  breakage: "卡到期",
  transfer: "轉帳",
};

const TZ = "Asia/Taipei";
const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];

function taipeiParts(iso: string) {
  const d = new Date(iso);
  const parts: Record<string, string> = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "short",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value])
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    weekday: WEEKDAY[weekday] ?? "",
  };
}

/** 「11/18（二）20:00」 */
export function periodLabel(iso: string) {
  const p = taipeiParts(iso);
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${p.month}/${p.day}（${p.weekday}）${hour}:${p.minute}`;
}

/** 「2026/11/18」 */
export function dateLabel(iso: string) {
  const p = taipeiParts(iso);
  return `${p.year}/${p.month}/${p.day}`;
}

/** 今天（台北）YYYY-MM-DD，給日期輸入框當預設。 */
export function todayKey() {
  const p = taipeiParts(new Date().toISOString());
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** API 錯誤碼 → 給人看的話。 */
const ERROR_TEXT: Record<string, string> = {
  FINANCE_FORBIDDEN: "只有管理員和分部負責人可以這樣做",
  ALREADY_SETTLED: "這堂已經結清了",
  NO_LOCATION: "這門課沒有分部，先在課程設定選分部",
  NOT_TAKEN: "還沒點名",
  NOT_STARTED: "分部還沒到轉換日",
  NO_PAYER: "這個分部還沒設負責人，請選誰付的",
  PAYER_NOT_KEEPER: "付錢的人要是某個分部的負責人",
  PERIOD_SETTLED: "這堂已經結清，先取消結清才能刪",
  RULE_BAD_REFERENCE: "規則裡有不是這個教室的老師、場地或分部",
  RULE_INVALID: "規則格式不對",
  VENUE_NAME_TAKEN: "已經有同名的場地",
  VENUE_IN_USE: "這個場地用過了，只能封存",
  VENUE_PER_SESSION: "這個場地是每次付，不用買次數包",
  KEEPER_NOT_MEMBER: "負責人要是這個教室的成員",
  TRANSFER_SAME_BRANCH: "請選兩個不同的分部",
};

export function financeErrorText(error: unknown, fallback = "出了點問題，請再試一次") {
  const code = (error as { data?: { code?: string } })?.data?.code;
  return (code && ERROR_TEXT[code]) || fallback;
}
