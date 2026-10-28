// 示意資料（docs/modules-plan.md 第 3 階段）：接上點名與課卡資料之前，水庫的每個畫面都讀這裡。
// 搬自 water-tank `src/lib/mock-data.ts`（工作目錄版）。據點、老師、老闆、會計的名字只出現在這個檔案；
// 所有日期都從下面的 `MONTH`／`TODAY` 推，元件裡不寫死月份。

import type {
  Branch,
  BranchPool,
  BranchSetting,
  BranchSettlement,
  CashHolding,
  CloseStep,
  EntryEvent,
  FundHolder,
  InTransitRemit,
  MainPool,
  MonthlyReport,
  MonthSession,
  MonthSummary,
  PayrollRow,
  PendingTask,
  PoolMovement,
  RemitRecord,
  RemitRule,
  RuleAllocation,
  RuleVersion,
  SessionDraft,
  SplitRule,
  Stamp,
  Tank,
  TankLevel,
  Transaction,
  Transfer,
  WeeklyFigure,
} from "./types";

// ── 時間 ──

const YEAR = 2026;
const MONTH = 10;
/** 示意資料裡的「今天」是這個月的幾號。 */
const TODAY = 24;

const pad = (n: number) => String(n).padStart(2, "0");
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 86_400_000);

/** 這個月（`monthOffset` 往前後推）某一天，「MM/DD」。 */
export function mockDate(day: number, monthOffset = 0): string {
  const d = new Date(YEAR, MONTH - 1 + monthOffset, day);
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/** 某個月的 1 號，「YYYY/MM/01」。 */
function monthStart(monthOffset: number): string {
  const d = new Date(YEAR, MONTH - 1 + monthOffset, 1);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/01`;
}

/** 「10 月 24 日（六）」 */
export function dayLabel(day: number): string {
  const d = new Date(YEAR, MONTH - 1, day);
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日（${WEEKDAYS[d.getDay()]}）`;
}

/** 「10/24」→「10 月 24 日（六）」（示意資料都在同一年）。 */
export function shortDateLabel(date: string): string {
  const [m, d] = date.split("/").map(Number);
  const day = new Date(YEAR, m - 1, d);
  return `${m} 月 ${d} 日（${WEEKDAYS[day.getDay()]}）`;
}

/** 「2026-10-24」→「10/24」 */
export const shortDateFromISO = (iso: string) => iso.slice(5).replace("-", "/");

/** 「10/24」→「2026-10-24」，給 `<input type="date">`。 */
export const isoFromShortDate = (date: string) => `${YEAR}-${date.replace("/", "-")}`;

const today = new Date(YEAR, MONTH - 1, TODAY);
/** 月底關帳 */
const closeDate = new Date(YEAR, MONTH, 0);
/** 下個月 5 號發薪 */
const paydayDate = new Date(YEAR, MONTH, 5);
const nextMonth = new Date(YEAR, MONTH, 1);

export const period = {
  /** 「2026 年 10 月」 */
  monthLabel: `${YEAR} 年 ${MONTH} 月`,
  /** 「10 月」 */
  monthName: `${MONTH} 月`,
  /** 「2026/10/24」 */
  today: `${YEAR}/${pad(MONTH)}/${pad(TODAY)}`,
  /** 「10/24」 */
  todayShort: mockDate(TODAY),
  /** `<input type="date">` 的預設值 */
  todayISO: `${YEAR}-${pad(MONTH)}-${pad(TODAY)}`,
  /** 「2026/10/01」 */
  firstDay: `${YEAR}/${pad(MONTH)}/01`,
  /** 「10/31」 */
  closeDay: `${closeDate.getMonth() + 1}/${closeDate.getDate()}`,
  /** 「11/5」 */
  payday: `${paydayDate.getMonth() + 1}/${paydayDate.getDate()}`,
  daysToClose: daysBetween(today, closeDate),
  daysToPayday: daysBetween(today, paydayDate),
  /** 新版本分帳規則預設的生效日：下個月 1 號 */
  nextMonthFirstISO: `${nextMonth.getFullYear()}-${pad(nextMonth.getMonth() + 1)}-01`,
};

// ── 人與據點（只在這裡出現）──

const TAINAN = "台南";
const KAOHSIUNG = "高雄";
export const SHARED_BRANCH: Branch = "共用";
export const BRANCHES: Branch[] = [TAINAN, KAOHSIUNG];
/** 記帳時可以選的據點：各據點＋共用 */
export const BRANCH_OPTIONS: Branch[] = [...BRANCHES, SHARED_BRANCH];

const OWNER = "老闆";
const ACCOUNTANT = "會計";
const ACCOUNT = "教室帳戶";
const DINGDING = "丁丁";
const TEACHER_B = "老師 B";
const TEACHER_C = "老師 C";
const TEACHER_D = "老師 D";

const HOLDER_ACCOUNT = ACCOUNT;
const HOLDER_DINGDING = `${DINGDING} · 現金`;
const HOLDER_B = `${TEACHER_B} · 現金`;
const HOLDER_C = `${TEACHER_C} · 現金`;
const HOLDER_OWNER = `${OWNER} · 現金`;
const HOLDER_KS_BOX = `${KAOHSIUNG}零用金盒`;

/** 示意：登入的人。第 4 階段換成目前登入的成員。 */
export const currentUser = DINGDING;

/** 錢放在哪、屬於哪個據點、手上現在有多少（流水帳的「錢在誰手上」、轉移的從／交給）。 */
export const fundHolders: FundHolder[] = [
  { name: HOLDER_ACCOUNT, branch: "大水庫", keeper: ACCOUNTANT, balance: 52300 },
  { name: HOLDER_DINGDING, branch: TAINAN, keeper: DINGDING, balance: 10650 },
  { name: HOLDER_C, branch: TAINAN, keeper: TEACHER_C, balance: 1800 },
  { name: HOLDER_B, branch: KAOHSIUNG, keeper: TEACHER_B, balance: 3200 },
  { name: HOLDER_OWNER, branch: KAOHSIUNG, keeper: OWNER, balance: 5300 },
  { name: HOLDER_KS_BOX, branch: KAOHSIUNG, keeper: OWNER, balance: 3000 },
];
export const FUND_HOLDERS: string[] = fundHolders.map((h) => h.name);
export const DEFAULT_HOLDER = HOLDER_DINGDING;

/** 示意：現在這一刻，以登入的人的名義（日期固定是示意的今天，時間是真的）。 */
export function stampNow(): Stamp {
  const now = new Date();
  return { by: currentUser, at: `${period.todayShort} ${pad(now.getHours())}:${pad(now.getMinutes())}` };
}

// ── 流水帳（記一筆與篩選共用同一份分類）──

export const INCOME_CATEGORIES = ["點名收入", "課卡（預收）", "單堂", "體驗課", "活動"];
export const EXPENSE_CATEGORIES = ["場租", "飲料", "廣告", "教師費", "活動"];
/** 課卡賣出時記為預收，上課才認列。 */
export const PREPAID_CATEGORY = "課卡（預收）";
export const LEDGER_CATEGORIES = [...new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES])];

/** 「10/23 21:15」：某一天的幾點幾分。 */
const at = (day: number, time: string) => `${mockDate(day)} ${time}`;
const created = (by: string, day: number, time: string): EntryEvent => ({ type: "created", by, at: at(day, time) });

/** 新到舊。編號照記錄的先後，所以 10/18 補記的酒水（#1035）排在 10/17 那一天。 */
export const transactions: Transaction[] = [
  { id: 1044, date: mockDate(24), category: "場租", description: "SALSA 體驗 場地 2 小時", branch: TAINAN, holder: HOLDER_DINGDING, amount: -250, history: [created(DINGDING, 24, "22:33")] },
  { id: 1043, date: mockDate(24), category: "點名收入", description: "SALSA 體驗 · 20:00", branch: TAINAN, holder: HOLDER_DINGDING, amount: 2000, history: [created(DINGDING, 24, "22:31")] },
  {
    id: 1042, date: mockDate(23), category: "飲料", description: "練習夜 礦泉水兩箱", branch: KAOHSIUNG, holder: HOLDER_B, amount: -360,
    history: [created(TEACHER_B, 23, "21:16"), { type: "archived", by: TEACHER_B, at: at(23, "21:20"), reason: "重複記了" }],
  },
  {
    id: 1041, date: mockDate(23), category: "飲料", description: "練習夜 礦泉水兩箱", branch: KAOHSIUNG, holder: HOLDER_B, amount: -360, missingReceipt: true,
    history: [
      created(TEACHER_B, 23, "21:15"),
      {
        type: "edited", by: DINGDING, at: at(24, "09:12"), reason: "收據上是 360，原本打錯",
        changes: [
          { field: "amount", from: -380, to: -360 },
          { field: "description", from: "礦泉水兩箱", to: "練習夜 礦泉水兩箱" },
        ],
      },
    ],
  },
  { id: 1040, date: mockDate(23), category: PREPAID_CATEGORY, description: "一般課卡 6 堂 × 2 張", branch: KAOHSIUNG, holder: HOLDER_B, amount: 4000, history: [created(TEACHER_B, 23, "21:12")] },
  {
    id: 1039, date: mockDate(22), category: "單堂", description: "BACHATA 初級 單堂 × 2", branch: TAINAN, holder: HOLDER_DINGDING, amount: 800,
    history: [
      created(DINGDING, 22, "21:50"),
      {
        type: "edited", by: DINGDING, at: at(22, "22:40"), reason: "實際只來 2 人",
        changes: [
          { field: "amount", from: 1200, to: 800 },
          { field: "description", from: "BACHATA 初級 單堂 × 3", to: "BACHATA 初級 單堂 × 2" },
        ],
      },
    ],
  },
  { id: 1038, date: mockDate(22), category: "廣告", description: "IG 廣告", branch: SHARED_BRANCH, holder: HOLDER_ACCOUNT, amount: -1200, history: [created(OWNER, 22, "10:02")] },
  { id: 1037, date: mockDate(20), category: "場租", description: "ZOUK 中級 場地 2 小時", branch: KAOHSIUNG, holder: HOLDER_OWNER, amount: -500, history: [created(OWNER, 20, "22:06")] },
  { id: 1036, date: mockDate(20), category: "點名收入", description: "ZOUK 中級 · 20:00", branch: KAOHSIUNG, holder: HOLDER_OWNER, amount: 3000, history: [created(OWNER, 20, "22:05")] },
  { id: 1035, date: mockDate(17), category: "飲料", description: "萬聖節舞會 酒水", branch: TAINAN, holder: HOLDER_DINGDING, amount: -1850, history: [created(DINGDING, 18, "10:16")] },
  { id: 1034, date: mockDate(17), category: "教師費", description: "萬聖節舞會 DJ 車馬費", branch: TAINAN, holder: HOLDER_DINGDING, amount: -1000, history: [created(DINGDING, 17, "23:58")] },
  { id: 1033, date: mockDate(17), category: "活動", description: "萬聖節舞會 布置", branch: TAINAN, holder: HOLDER_DINGDING, amount: -1090, missingReceipt: true, history: [created(TEACHER_C, 17, "23:55")] },
  {
    id: 1032, date: mockDate(17), category: "飲料", description: "萬聖節舞會 酒水", branch: TAINAN, holder: HOLDER_DINGDING, amount: -2850,
    history: [created(DINGDING, 17, "23:51"), { type: "archived", by: DINGDING, at: at(18, "10:15"), reason: "金額打錯，重記一筆（#1035）" }],
  },
  { id: 1031, date: mockDate(17), category: "場租", description: "萬聖節舞會 場地 5 小時", branch: TAINAN, holder: HOLDER_DINGDING, amount: -3000, history: [created(DINGDING, 17, "23:50")] },
  { id: 1030, date: mockDate(17), category: "活動", description: "萬聖節舞會 門票 × 30", branch: TAINAN, holder: HOLDER_DINGDING, amount: 9000, history: [created(DINGDING, 17, "23:48")] },
];

/** 金錢轉移（新到舊）。10/20 那筆就是資金頁「轉帳中」的繳回。 */
export const transfers: Transfer[] = [
  {
    id: "T-1021", date: mockDate(24), from: HOLDER_DINGDING, to: HOLDER_B, fromBranch: TAINAN, toBranch: KAOHSIUNG, receiver: TEACHER_B,
    amount: 6000, method: "cash", note: "高雄下週場租週轉",
    sent: { by: DINGDING, at: at(24, "23:05") }, confirmed: { by: TEACHER_B, at: at(24, "23:40") },
  },
  {
    id: "T-1020", date: mockDate(20), from: HOLDER_DINGDING, to: HOLDER_ACCOUNT, fromBranch: TAINAN, toBranch: "大水庫", receiver: ACCOUNTANT,
    amount: 6000, method: "bank", ref: "38211", note: "繳回大水庫",
    sent: { by: DINGDING, at: at(20, "22:10") },
  },
];

// ── 儀表板 ──

export const tankLevel: TankLevel = { booked: -7150, unrecognizedPrepaid: 38000, unusedClasses: 114, updatedAt: "21:40" };

export const monthSummary: MonthSummary = {
  income: { recognized: 86400, classes: 42, cardSales: 24000 },
  expense: { rent: 15750, other: 5600 },
  toTank: { contribution: 5940, leftover: 480, poolRate: 0.1 },
};

export const weekly: WeeklyFigure[] = [
  { label: "第 1 週", income: 21600, expense: 8200 },
  { label: "第 2 週", income: 23400, expense: 3150 },
  { label: "第 3 週", income: 19800, expense: 6400 },
  { label: "第 4 週", income: 21600, expense: 3600 },
];

const missingReceipts = transactions.filter((tx) => tx.missingReceipt).length;

export const pendingTasks: PendingTask[] = [
  { id: "sessions", label: "3 堂課還沒輸入點名收入", action: "去結算", page: "sessions", tone: "water" },
  { id: "receipts", label: `${missingReceipts} 筆支出缺收據照片`, action: "補上", page: "ledger", tone: "expense" },
  { id: "close", label: `${period.monthName}關帳 · 剩 ${period.daysToClose} 天`, action: "檢查", page: "close", tone: "neutral" },
];

// ── 資金與繳回：大水庫（總部）＋各據點小水庫 ──

export const mainPool: MainPool = {
  owner: OWNER,
  accountant: ACCOUNTANT,
  account: ACCOUNT,
  positions: [
    { id: "bank", name: `${ACCOUNT}（銀行）`, amount: 52300 },
    { id: "owner-cash", name: `${OWNER}手上現金`, note: `${KAOHSIUNG}收的`, amount: 5300, canDeposit: true },
    { id: "ks-box", name: HOLDER_KS_BOX, amount: 3000 },
  ],
};

export const branchPools: BranchPool[] = [
  {
    id: "tainan",
    name: `${TAINAN}小水庫`,
    branch: TAINAN,
    keeper: DINGDING,
    balance: 12450,
    reserve: 2000,
    alertThreshold: 10000,
    lastRemit: { date: mockDate(20), daysAgo: TODAY - 20, amount: 6000 },
    holders: [
      { name: DINGDING, amount: 10650, note: "6 筆" },
      { name: TEACHER_C, amount: 1800, note: `${mockDate(23)} 體驗課收的`, pending: true },
    ],
  },
];

export const inTransit: InTransitRemit[] = [
  {
    id: "r-1020",
    poolId: "tainan",
    from: `${TAINAN}小水庫`,
    by: DINGDING,
    at: `${mockDate(20)} 22:10`,
    method: "銀行轉帳",
    ref: "末五碼 38211 · 附轉帳截圖",
    amount: 6000,
  },
];

export const remitHistory: RemitRecord[] = [
  { id: "r-1020", date: mockDate(20), from: `${TAINAN}小水庫 · ${DINGDING}`, method: "銀行轉帳", status: "in-transit", amount: 6000 },
  { id: "r-1005", date: mockDate(5), from: `大水庫內 · ${OWNER}`, method: "手上現金存進銀行", status: "confirmed", amount: 9800 },
  { id: "r-0930", date: mockDate(30, -1), from: `${TAINAN}小水庫 · ${DINGDING}`, method: "抵扣分潤＋轉帳", status: "confirmed", amount: 14200 },
];

/** 各小水庫上次繳回後的進出（新到舊）；每筆之後的餘額由畫面從目前餘額往回推。 */
export const poolMovements: Record<string, PoolMovement[]> = {
  tainan: [
    { id: "m8", date: mockDate(24), item: "萬聖節舞會 門票", by: DINGDING, amount: 4500 },
    { id: "m7", date: mockDate(24), item: "場租 · SALSA 體驗", by: DINGDING, amount: -250 },
    { id: "m6", date: mockDate(24), item: "SALSA 體驗 · 點名收入", by: DINGDING, amount: 2000 },
    { id: "m5", date: mockDate(23), item: "體驗課 × 3", by: TEACHER_C, amount: 1800 },
    { id: "m4", date: mockDate(22), item: "場租 · BACHATA 初級", by: DINGDING, amount: -400 },
    { id: "m3", date: mockDate(22), item: "BACHATA 單堂 × 2", by: DINGDING, amount: 800 },
    { id: "m2", date: mockDate(21), item: "課卡 6 堂（預收）", by: DINGDING, amount: 2000 },
    { id: "m1", date: mockDate(20), item: "繳回大水庫 · 轉帳中", by: DINGDING, amount: -6000, internal: true },
  ],
};

export const branchSettings: BranchSetting[] = [
  { branch: TAINAN, mode: "pool", collectors: 2, keeperOptions: [DINGDING, TEACHER_C], reserve: 2000, threshold: 10000 },
  { branch: KAOHSIUNG, mode: "direct", collectors: 2, keeperOptions: [TEACHER_B, TEACHER_D], reserve: 3000, threshold: 10000 },
];

export const remitRules: RemitRule[] = [
  { id: "before-close", title: "每月關帳前一定要繳清", note: "只留零用金，其他都要回到大水庫，才能關帳", enabled: true },
  { id: "threshold", title: "超過 NT$10,000 或 14 天沒繳就提醒", note: "平常想什麼時候繳都可以", enabled: true },
  { id: "weekly", title: "固定每週日繳回", note: "要更規律的話再打開", enabled: false },
];

// ── 場次分帳與規則 ──

export const rules: SplitRule[] = [
  { id: "duo", name: "常態雙師", version: 3, status: "active", effectiveFrom: monthStart(-1), sessionCount: 18, poolRate: 0.1, roundUnit: 10 },
  { id: "solo", name: "常態單師", version: 1, status: "active", sessionCount: 6, poolRate: 0.1, roundUnit: 10 },
  { id: "trial", name: "體驗課", version: 2, status: "active", sessionCount: 4, poolRate: 0.1, roundUnit: 10 },
  { id: "workshop", name: "外師 Workshop", version: 1, status: "draft", draftNote: "分帳模式待決定", poolRate: 0.1, roundUnit: 10 },
];

/** 分帳規則頁打開時編輯的那一條。 */
export const EDITING_RULE_ID = "duo";

export const ruleAllocations: RuleAllocation[] = [
  { id: "a1", role: "主教", method: "份數", value: "1" },
  { id: "a2", role: "主教", method: "份數", value: "1" },
  { id: "a3", role: "助教（選填）", method: "固定金額", value: "300", optional: true },
];

export const ROLE_OPTIONS = ["主教", "助教（選填）", "雙師"];

export const ruleVersions: RuleVersion[] = [
  { version: 1, effectiveFrom: monthStart(-19), note: "水庫 15%、捨去到 100" },
  { version: 2, effectiveFrom: monthStart(-9), note: "水庫改 10%" },
  { version: 3, effectiveFrom: monthStart(-1), note: "取整改為捨去到 10" },
];

/** 場次分帳頁試算的那一堂。 */
export const session: SessionDraft = {
  title: "SALSA 體驗",
  time: "20:00",
  day: TODAY,
  branch: TAINAN,
  ruleId: "duo",
  income: 2000,
  rent: 250,
  members: [
    { name: DINGDING, role: "主教" },
    { name: TEACHER_B, role: "主教" },
  ],
};

// ── 月結 ──

export const payroll: PayrollRow[] = [
  { name: DINGDING, classes: 18, total: 23460, confirmed: true },
  { name: TEACHER_B, classes: 14, total: 17820, confirmed: true },
  { name: TEACHER_C, classes: 9, total: 10350, confirmed: false },
  { name: TEACHER_D, classes: 6, total: 6900, confirmed: false },
];

const confirmedPayslips = payroll.filter((p) => p.confirmed).length;

export const closeSteps: CloseStep[] = [
  { label: "關帳", note: `${period.closeDay} 已鎖定 312 筆` },
  { label: "薪資單", note: `確認中 · ${confirmedPayslips} / ${payroll.length} 位` },
  { label: "結算建議", note: `${ACCOUNTANT}產生 · ${OWNER}核准` },
  { label: "發放與月報", note: "轉帳 → 確認收到 → 月報" },
];
/** 目前做到第幾步（0 起算）。 */
export const CURRENT_CLOSE_STEP = 1;

/** 關帳時點：教室的錢還在誰手上（大水庫以外）。月結時先拿來抵自己的分潤。 */
export const closeHoldings: CashHolding[] = [
  { name: DINGDING, source: `${TAINAN}小水庫現金（${TEACHER_C} 的已收齊）`, amount: 14250, reserve: 2000 },
  { name: TEACHER_B, source: `${KAOHSIUNG}課卡現金，還沒交給${OWNER}`, amount: 19600 },
];

export const closeTank: Tank = { owner: OWNER, account: ACCOUNT };

/** 這個月上過的課（新到舊），逐堂明細從這裡算。 */
export const monthSessions: MonthSession[] = [
  { id: "s7", date: mockDate(24), title: "SALSA 體驗", branch: TAINAN, ruleId: "duo", income: 2000, rent: 250, members: [DINGDING, TEACHER_B] },
  { id: "s6", date: mockDate(23), title: "體驗課", branch: TAINAN, ruleId: "trial", income: 1800, rent: 250, members: [TEACHER_C] },
  { id: "s5", date: mockDate(22), title: "BACHATA 初級", branch: TAINAN, ruleId: "duo", income: 3996, rent: 400, members: [DINGDING, TEACHER_B] },
  { id: "s4", date: mockDate(21), title: "BACHATA 中級", branch: KAOHSIUNG, ruleId: "duo", income: 3600, rent: 500, members: [TEACHER_B, TEACHER_D] },
  { id: "s3", date: mockDate(20), title: "ZOUK 中級", branch: KAOHSIUNG, ruleId: "solo", income: 3000, rent: 500, members: [DINGDING] },
  { id: "s2", date: mockDate(17), title: "SALSA 初級", branch: TAINAN, ruleId: "solo", income: 3200, rent: 400, members: [TEACHER_C] },
  { id: "s1", date: mockDate(16), title: "練習夜", branch: KAOHSIUNG, ruleId: "solo", income: 1500, rent: 300, members: [TEACHER_D] },
];

export const branchSettlement: BranchSettlement = {
  from: TAINAN,
  to: KAOHSIUNG,
  amount: 1332,
  note: `${TAINAN}課卡在${KAOHSIUNG}上課 4 堂（是否分開設帳待決定）`,
};

export const monthlyReport: MonthlyReport = {
  income: monthSummary.income.recognized,
  expense: monthSummary.expense.rent + monthSummary.expense.other,
  payroll: payroll.reduce((sum, p) => sum + p.total, 0),
  prepaidBalance: tankLevel.unrecognizedPrepaid,
};
