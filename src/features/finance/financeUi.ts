import { addDays } from "@/domains/ledger/lines";
import { toTaipeiDateKey } from "@/lib/taipei-date";

/** 台北今天 YYYY-MM-DD。 */
export const todayKey = () => toTaipeiDateKey(new Date());

/** 日期欄的上限：擋掉 6 位數的年份（瀏覽器預設可以打到 275760 年）。 */
export const DATE_INPUT_MAX = "9999-12-31";

/** 「算到／結帳到哪一天」的預設：上個月底；若上個月底在開帳日之前（剛開帳的第一個月），改成今天。 */
export function defaultAsOf(conversionDate?: string | null): string {
  const lastMonthEnd = addDays(`${todayKey().slice(0, 7)}-01`, -1);
  return conversionDate && lastMonthEnd < conversionDate ? todayKey() : lastMonthEnd;
}

const ERROR_TEXT: Record<string, string> = {
  REFUND_EXCEEDS_VALUE: "退費金額超過這張卡剩下的價值",
  CARD_NOT_PAID: "這張卡還沒付款，不能退費",
  CARD_CLOSED: "這張卡已經停用或退過費",
  NOT_FINANCE_MEMBER: "要選保管人，先在財務成員勾成保管人",
  // 財務 v2
  PERIOD_LOCKED: "這一天已經鎖帳，改記在鎖帳日之後",
  BEFORE_CONVERSION: "這一天在開帳日之前，帳本不記",
  NOT_FINANCE: "只有可以結算的人（或這個帳戶的保管人）能做這件事",
  OWNER_ONLY: "只有教室擁有者能解鎖或把鎖帳日往前",
  LOCK_IN_FUTURE: "不能鎖還沒到的日子",
  LEDGER_NOT_OPENED: "要先開帳才能鎖帳",
  LEDGER_LOCKED: "已經鎖過帳，不能再重開",
  OPENING_INCOMPLETE: "還有收過錢的人沒有資金帳戶，先替他建帳戶",
  UNBALANCED: "借貸不平衡",
  INVALID_ACCOUNT: "這個科目不能用（現金要記在某個資金帳戶，分部往來會自動補）",
  INVALID_LOCATION: "資金帳戶的分錄要記在它所屬的分部",
  ALREADY_REVERSED: "這筆已經沖銷過了",
  NOT_REVERSIBLE: "系統自動記的分錄不能沖銷，請改原本那筆紀錄",
  PAYOUT_NOT_PENDING: "這筆已經處理過了",
  TRANSFER_NOT_PENDING: "這筆已經處理過了",
  INVALID_MONEY_ACCOUNT: "請選一個資金帳戶",
  NOT_KEEPER: "只有這個分部的負責人或擁有者能簽核",
  VENUE_NAME_TAKEN: "已經有同名的場地了",
  VENUE_IN_USE: "這個場地用過了（分帳規則或次數包），只能封存",
  VENUE_NO_BRANCH: "這個場地還沒選分部，先編輯場地選分部",
  BRANCH_NO_KEEPER: "場地的分部還沒有負責人，先到分部設定負責人",
  LOCATION_NOT_FOUND: "找不到這個分部",
};

/** RTK Query 的錯誤 → 白話。 */
export function financeErrorText(e: unknown, fallback = "操作失敗，請再試一次"): string {
  const code = (e as { data?: { code?: string } })?.data?.code;
  return (code && ERROR_TEXT[code]) || fallback;
}

export const monthLabel = (month: string) => `${month.slice(0, 4)} 年 ${Number(month.slice(5))} 月`;

/** 往前／往後推 n 個月。 */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}
