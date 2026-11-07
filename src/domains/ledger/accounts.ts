// 系統科目表（docs/finance-v2/02-accounting-model.md §2）。
// 代碼取自經濟部《商業會計項目表》112 年版；表上沒有的用同大類自訂碼。
// 名稱教室可以改；程式只認 systemKey。

export type LedgerAccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";

export const SYSTEM_ACCOUNTS = [
  { key: "CASH", code: "1111", name: "現金（資金帳戶）", type: "ASSET" },
  { key: "AR", code: "1191", name: "應收學費", type: "ASSET" },
  { key: "PREPAID_VENUE", code: "1260", name: "預付場地費", type: "ASSET" },
  { key: "INTERBRANCH", code: "1990", name: "分部往來", type: "ASSET" },
  { key: "DEFERRED_REVENUE", code: "2222", name: "預收學費", type: "LIABILITY" },
  { key: "TEACHER_PAYABLE", code: "2197.01", name: "應付老師報酬", type: "LIABILITY" },
  { key: "TEACHER_PAYABLE_HELD", code: "2197.02", name: "應付老師報酬－待學生付款", type: "LIABILITY" },
  { key: "VENUE_PAYABLE", code: "2192", name: "應付場地費", type: "LIABILITY" },
  { key: "OWNER_PAYABLE", code: "2393", name: "應付業主款", type: "LIABILITY" },
  { key: "OWNER_CONTRIBUTION", code: "3110", name: "業主投入", type: "EQUITY" },
  { key: "OWNER_DRAWING", code: "3190", name: "業主提取", type: "EQUITY" },
  { key: "RETAINED_EARNINGS", code: "3351", name: "公積金（累積盈餘）", type: "EQUITY" },
  { key: "OPENING_EQUITY", code: "3390", name: "期初權益調整", type: "EQUITY" },
  { key: "REVENUE_LESSON", code: "4121", name: "課程收入", type: "INCOME" },
  { key: "REVENUE_DROPIN", code: "4122", name: "單堂收入", type: "INCOME" },
  { key: "REVENUE_BREAKAGE", code: "4123", name: "過期收入", type: "INCOME" },
  { key: "REVENUE_OTHER", code: "4888", name: "其他收入", type: "INCOME" },
  { key: "EXPENSE_TEACHER", code: "6111", name: "老師報酬", type: "EXPENSE" },
  { key: "EXPENSE_VENUE", code: "6112", name: "場地費", type: "EXPENSE" },
  { key: "EXPENSE_GENERAL", code: "6100", name: "營業費用", type: "EXPENSE" },
  { key: "EXPENSE_BAD_DEBT", code: "6180", name: "呆帳", type: "EXPENSE" },
  { key: "CASH_OVER_SHORT", code: "6190", name: "現金短溢", type: "EXPENSE" },
  { key: "ROUNDING", code: "6191", name: "尾差", type: "EXPENSE" },
] as const satisfies readonly { key: string; code: string; name: string; type: LedgerAccountType }[];

export type SystemAccountKey = (typeof SYSTEM_ACCOUNTS)[number]["key"];

/** 營業費用的預設子科目（沿用 feat/finance 的支出類別）。 */
export const DEFAULT_EXPENSE_SUBACCOUNTS = ["廣告", "海報", "飲料", "宵夜", "慶功宴", "其他"] as const;

/**
 * 分錄行指向科目的方式（純函式不知道 DB id）：
 * - 系統科目：`{ key }`
 * - 某個資金帳戶的現金子科目：`{ moneyAccountId }`
 * - 任意科目（例：營業費用子科目、手動分錄）：`{ accountId }`
 */
export type AccountRef =
  | { key: SystemAccountKey }
  | { moneyAccountId: number }
  | { accountId: number };

export function accountRefKey(ref: AccountRef): string {
  if ("key" in ref) return `K:${ref.key}`;
  if ("moneyAccountId" in ref) return `M:${ref.moneyAccountId}`;
  return `A:${ref.accountId}`;
}

export function parseAccountRefKey(s: string): AccountRef {
  const [tag, rest] = [s.slice(0, 1), s.slice(2)];
  if (tag === "K") return { key: rest as SystemAccountKey };
  if (tag === "M") return { moneyAccountId: Number(rest) };
  if (tag === "A") return { accountId: Number(rest) };
  throw new Error(`bad account ref key: ${s}`);
}

/** 借方餘額為正常餘額的科目類別（資產、費用）。報表顯示時用來決定正負號。 */
export function isDebitNormal(type: LedgerAccountType): boolean {
  return type === "ASSET" || type === "EXPENSE";
}
