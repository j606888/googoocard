/**
 * 水庫畫面的資料形狀。現在由 `mockData.ts` 提供，第 4 階段換成 API 回傳，
 * 元件的 props 型別不用再改。
 */
import type { CashHolding, Payee, Tank } from "@/domains/finance/settlement";
import type { RoundUnit } from "@/domains/finance/split";
import type { FinancePage } from "./routes";

export type { CashHolding, Payee, Tank, RoundUnit };

/** 據點名稱（第 4 階段對應到 googoocard 的 `Location`）。 */
export type Branch = string;

export type Direction = "income" | "expense";

/** 誰、什麼時候。`at` 是「MM/DD HH:mm」。 */
export type Stamp = { by: string; at: string };

/** 流水帳一筆裡可以編輯的欄位。 */
export type EntryValues = {
  /** 「MM/DD」 */
  date: string;
  category: string;
  description: string;
  branch: Branch;
  /** 錢現在在誰手上／放在哪 */
  holder: string;
  /** 正數是收入、負數是支出 */
  amount: number;
};

export type EntryField = keyof EntryValues;

export type FieldChange = { field: EntryField; from: string | number; to: string | number };

/** 一筆帳發生過的事（舊到新）。記錄、修改、封存、還原都留著，不會消失。 */
export type EntryEvent =
  | (Stamp & { type: "created" })
  | (Stamp & { type: "edited"; reason: string; changes: FieldChange[] })
  | (Stamp & { type: "archived"; reason: string })
  | (Stamp & { type: "restored" });

/**
 * 流水帳的一筆。可以編輯和封存，但每次改動都記在 `history`（第一筆一定是 `created`），
 * 封存的不算進收支、也不會真的刪掉。
 */
export type Transaction = EntryValues & {
  id: number;
  missingReceipt?: boolean;
  history: EntryEvent[];
};

/** 錢放在哪：某個人手上的現金、教室帳戶、零用金盒。 */
export type FundHolder = {
  name: string;
  /** 據點；教室帳戶是「大水庫」 */
  branch: string;
  /** 轉移給這個位置時，誰要按「確認收到」 */
  keeper: string;
  balance: number;
};

export type TransferMethod = "cash" | "bank";

/** 金錢轉移：錢從一個資金位置交給另一個。不算收入也不算支出；收的人確認收到才算完成。 */
export type Transfer = {
  id: string;
  /** 「MM/DD」 */
  date: string;
  from: string;
  to: string;
  fromBranch: string;
  toBranch: string;
  /** 要確認收到的人 */
  receiver: string;
  amount: number;
  method: TransferMethod;
  /** 轉帳末五碼 */
  ref?: string;
  note?: string;
  sent: Stamp;
  confirmed?: Stamp;
};

// ── 儀表板 ──

export type TankLevel = {
  /** 帳上餘額（可能是負的：課卡賣出時記為預收） */
  booked: number;
  /** 還沒認列的預收課卡 */
  unrecognizedPrepaid: number;
  /** 預收課卡還有幾堂沒上 */
  unusedClasses: number;
  /** 「HH:mm」 */
  updatedAt: string;
};

export type MonthSummary = {
  income: { recognized: number; classes: number; cardSales: number };
  expense: { rent: number; other: number };
  toTank: { contribution: number; leftover: number; poolRate: number };
};

export type WeeklyFigure = { label: string; income: number; expense: number };

export type PendingTaskTone = "water" | "expense" | "neutral";

export type PendingTask = { id: string; label: string; action: string; page: FinancePage; tone: PendingTaskTone };

// ── 資金與繳回 ──

export type BranchFundMode = "pool" | "direct";

export type MainPoolPosition = {
  id: string;
  name: string;
  amount: number;
  note?: string;
  /** 手上的現金，可以存進銀行 */
  canDeposit?: boolean;
};

/** 大水庫（總部）：負責人、會計、銀行帳戶，以及錢放在哪幾個位置。 */
export type MainPool = {
  owner: string;
  accountant: string;
  account: string;
  positions: MainPoolPosition[];
};

export type PoolHolder = { name: string; amount: number; note?: string; pending?: boolean };

/** 據點的小水庫：保管人收齊，再繳回大水庫。 */
export type BranchPool = {
  id: string;
  name: string;
  branch: Branch;
  keeper: string;
  balance: number;
  /** 保留在手上的零用金 */
  reserve: number;
  /** 可繳回超過多少就提醒 */
  alertThreshold: number;
  /** 上次繳回（還在「轉帳中」的話看 `InTransitRemit.poolId`） */
  lastRemit: { date: string; daysAgo: number; amount: number };
  holders: PoolHolder[];
};

/** 已經送出、大水庫還沒確認收到的繳回。 */
export type InTransitRemit = {
  id: string;
  poolId: string;
  from: string;
  by: string;
  at: string;
  method: string;
  ref: string;
  amount: number;
};

export type RemitStatus = "in-transit" | "confirmed";

export type RemitRecord = { id: string; date: string; from: string; method: string; status: RemitStatus; amount: number };

/** 小水庫上次繳回後的進出（新到舊）。 */
export type PoolMovement = { id: string; date: string; item: string; by: string; amount: number; internal?: boolean };

export type BranchSetting = {
  branch: Branch;
  mode: BranchFundMode;
  collectors: number;
  keeperOptions: string[];
  reserve: number;
  threshold: number;
};

export type RemitRule = { id: string; title: string; note: string; enabled: boolean };

// ── 場次分帳與規則 ──

export type SessionMember = { name: string; role: string };

/** 一個待結算的課程場次。 */
export type SessionDraft = {
  title: string;
  time: string;
  /** 這個月的幾號 */
  day: number;
  branch: Branch;
  ruleId: string;
  income: number;
  rent: number;
  members: SessionMember[];
};

export type SplitRule = {
  id: string;
  name: string;
  version: number;
  status: "active" | "draft";
  /** 「YYYY/MM/DD」：這個版本從哪天起生效 */
  effectiveFrom?: string;
  sessionCount?: number;
  draftNote?: string;
  poolRate: number;
  roundUnit: RoundUnit;
};

export type AllocationMethod = "份數" | "百分比" | "固定金額";

export type RuleAllocation = { id: string; role: string; method: AllocationMethod; value: string; optional?: boolean };

export type RuleVersion = { version: number; effectiveFrom: string; note: string };

// ── 月結 ──

export type CloseStep = { label: string; note: string };

export type PayrollRow = { name: string; classes: number; total: number; confirmed: boolean };

/** 這個月上過的一堂課：誰教、收入多少、場租多少。逐堂明細用它算。 */
export type MonthSession = {
  id: string;
  date: string;
  title: string;
  branch: Branch;
  ruleId: string;
  income: number;
  rent: number;
  members: string[];
};

export type BranchSettlement = { from: Branch; to: Branch; amount: number; note: string };

export type MonthlyReport = { income: number; expense: number; payroll: number; prepaidBalance: number };
