/**
 * 奇異鳥小鎮的示意資料與規則（docs/finance-game-style.md、docs/finance-plan.md 第一步）。
 *
 * 只活在記憶體裡：沒有 API、重新整理就還原。這裡的推導（誰手上有多少、財庫多少、
 * 公司的錢怎麼拆）之後接真資料時會搬到 server，所以寫成純函式、有測試。
 */

export type MemberId = "dd" | "teacherB" | "boss";
export type PayMethod = "cash" | "transfer";

export interface TownMember {
  id: MemberId;
  name: string;
  /** 圍巾顏色＝這個人（style doc §3.4）。 */
  scarf: string;
  /** 營收負責人：他收的錢直接進主堡，也只有他能確認繳回、記大水庫支出。 */
  isOwner: boolean;
}

export const MEMBERS: readonly TownMember[] = [
  { id: "dd", name: "丁丁", scarf: "#4BB38B", isOwner: false },
  { id: "teacherB", name: "老師 B", scarf: "#7FA8E0", isOwner: false },
  { id: "boss", name: "老闆", scarf: "#E58B7A", isOwner: true },
];

export const CUSTODIANS = MEMBERS.filter((m) => !m.isOwner);

export function memberOf(id: MemberId): TownMember {
  return MEMBERS.find((m) => m.id === id) ?? MEMBERS[0];
}

/** 學生付的一筆課卡錢（之後讀 StudentCard 的 paidByUserId／finalPrice）。 */
export interface Collection {
  id: string;
  receiverId: MemberId;
  date: string;
  student: string;
  item: string;
  amount: number;
  method: PayMethod;
  /** 這次操作時按「模擬收款」加的：算進預收。 */
  isNew?: boolean;
}

export type RemitStatus = "pending" | "confirmed" | "rejected" | "withdrawn";

/** 代收人把錢送回主堡（之後是 FinanceRemittance）。 */
export interface Remittance {
  id: string;
  fromId: MemberId;
  amount: number;
  method: PayMethod;
  ref?: string;
  date: string;
  note?: string;
  status: RemitStatus;
  reason?: string;
}

export type EntryCategory = "venue" | "assistant" | "salary" | "party" | "other" | "loan";

export const EXPENSE_CATEGORIES: readonly { value: Exclude<EntryCategory, "loan">; label: string }[] = [
  { value: "venue", label: "場地費" },
  { value: "assistant", label: "助教費" },
  { value: "salary", label: "發薪" },
  { value: "party", label: "Party／公共" },
  { value: "other", label: "其他" },
];

export const CATEGORY_LABELS: Record<EntryCategory, string> = {
  venue: "場地費",
  assistant: "助教費",
  salary: "發薪",
  party: "Party／公共",
  other: "其他",
  loan: "老闆補錢",
};

/** 上課的地方（分部）。只是場地與報表標籤：課卡兩地共用，錢不分地區、都回主堡。 */
export type Place = "tainan" | "kaohsiung";

export const PLACES: Record<Place, { name: string; short: string; rules: readonly string[]; members: readonly MemberId[] }> = {
  tainan: {
    name: "台南 · 丁丁家",
    short: "台南",
    rules: ["場地是丁丁家：老闆每天付丁丁場地費 $500", "助教 $250／位，老闆出，跟學生多少無關", "台南的課卡錢都由丁丁代收，再送回主堡"],
    members: ["dd"],
  },
  kaohsiung: {
    name: "高雄 · 租的教室",
    short: "高雄",
    rules: ["場租是預設值，臨時換教室時可以改", "每堂扣完場租，再抽 10% 進水庫基金", "主堡（大水庫）也在高雄，老闆保管"],
    members: ["teacherB", "boss"],
  },
};

/** 會掛在某個地方的支出分類（場地費、助教費）。 */
export const PLACE_CATEGORIES: readonly EntryCategory[] = ["venue", "assistant"];

/** 老闆手記的大水庫帳（之後是 FinanceEntry）。支出是負數；老闆補錢是正數。 */
export interface VaultEntry {
  id: string;
  date: string;
  category: EntryCategory;
  amount: number;
  payee?: string;
  note: string;
  /** 場地費、助教費是哪個地方的。 */
  place?: Place;
  isNew?: boolean;
}

export interface TownState {
  collections: Collection[];
  remittances: Remittance[];
  entries: VaultEntry[];
  /** 新增資料用的流水號。 */
  seq: number;
}

/** 示意資料的「今天」。 */
export const TODAY = "2026-10-28";

export const SETTINGS = {
  openingDate: "2026-09-30",
  openingBalance: 48000,
  /** 幾天沒繳回標紅（水庫設定）。 */
  overdueDays: 14,
  /** 推車沙漏條的期限：等這麼多天就滿格。 */
  confirmLimitDays: 3,
  /** 第二步才算得出來的數字，示意版先固定。 */
  prepaidBase: 31000,
  payableBase: 17800,
  loanBase: 120000,
  /** 主堡倉庫裡 1 箱代表多少錢。 */
  crateUnit: 1000,
} as const;

export const INITIAL_STATE: TownState = {
  collections: [
    // 丁丁（台南）10 月收的 7 筆，共 $16,000
    { id: "c1", receiverId: "dd", date: "2026-10-03", student: "王同學", item: "一般課卡 6 堂", amount: 2000, method: "cash" },
    { id: "c2", receiverId: "dd", date: "2026-10-07", student: "陳先生", item: "一般課卡 12 堂", amount: 3800, method: "transfer" },
    { id: "c3", receiverId: "dd", date: "2026-10-12", student: "林小姐", item: "一般課卡 6 堂", amount: 2000, method: "transfer" },
    { id: "c4", receiverId: "dd", date: "2026-10-14", student: "黃同學", item: "單堂", amount: 400, method: "cash" },
    { id: "c5", receiverId: "dd", date: "2026-10-19", student: "張小姐", item: "一般課卡 6 堂", amount: 2000, method: "cash" },
    { id: "c6", receiverId: "dd", date: "2026-10-21", student: "周同學", item: "一般課卡 12 堂", amount: 3800, method: "transfer" },
    { id: "c7", receiverId: "dd", date: "2026-10-26", student: "吳小姐", item: "一般課卡 6 堂", amount: 2000, method: "cash" },
    // 老師 B（高雄）9/26 收的，一直沒繳
    { id: "c8", receiverId: "teacherB", date: "2026-09-26", student: "蘇同學", item: "一般課卡 12 堂", amount: 3800, method: "transfer" },
    // 老闆自己收的，直接進主堡，10 月共 $21,400
    { id: "c9", receiverId: "boss", date: "2026-10-02", student: "李同學", item: "一般課卡 12 堂", amount: 3800, method: "transfer" },
    { id: "c10", receiverId: "boss", date: "2026-10-05", student: "郭小姐", item: "一般課卡 6 堂", amount: 2000, method: "cash" },
    { id: "c11", receiverId: "boss", date: "2026-10-09", student: "蔡同學", item: "一般課卡 12 堂", amount: 3800, method: "transfer" },
    { id: "c12", receiverId: "boss", date: "2026-10-16", student: "何先生", item: "一般課卡 12 堂", amount: 3800, method: "transfer" },
    { id: "c13", receiverId: "boss", date: "2026-10-20", student: "許小姐", item: "一般課卡 6 堂", amount: 2000, method: "cash" },
    { id: "c14", receiverId: "boss", date: "2026-10-24", student: "江同學", item: "一般課卡 12 堂", amount: 3800, method: "transfer" },
    { id: "c15", receiverId: "boss", date: "2026-10-25", student: "葉小姐", item: "一般課卡 6 堂", amount: 2000, method: "cash" },
    { id: "c16", receiverId: "boss", date: "2026-10-27", student: "體驗課 2 人", item: "體驗課", amount: 200, method: "cash" },
  ],
  remittances: [
    { id: "r1", fromId: "dd", amount: 8200, method: "transfer", ref: "38211", date: "2026-10-15", status: "confirmed" },
    { id: "r2", fromId: "dd", amount: 5800, method: "cash", date: "2026-10-27", status: "pending" },
  ],
  entries: [
    { id: "e1", date: "2026-10-01", category: "venue", amount: -12000, payee: "高雄房東", note: "高雄場租 10 月", place: "kaohsiung" },
    { id: "e2", date: "2026-10-05", category: "salary", amount: -14000, payee: "老師們", note: "9 月薪資" },
    { id: "e3", date: "2026-10-12", category: "venue", amount: -1000, payee: "丁丁", note: "台南場地費 10/5、10/12", place: "tainan" },
    { id: "e4", date: "2026-10-12", category: "assistant", amount: -1500, payee: "助教", note: "助教費 6 人次", place: "tainan" },
    { id: "e5", date: "2026-10-18", category: "party", amount: -1400, payee: "全聯", note: "Party 酒水" },
    { id: "e6", date: "2026-10-26", category: "venue", amount: -1000, payee: "丁丁", note: "台南場地費 10/19、10/26", place: "tainan" },
  ],
  seq: 100,
};

// ---------- 推導 ----------

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** 已經離開背包的錢：送出還沒確認的、已確認的。退回、撤回的會回到手上。 */
function leftHand(r: Remittance) {
  return r.status === "pending" || r.status === "confirmed";
}

/** 代收人手上還沒交的錢。 */
export function holdingOf(state: TownState, id: MemberId): number {
  if (memberOf(id).isOwner) return 0;
  const collected = sum(state.collections.filter((c) => c.receiverId === id).map((c) => c.amount));
  const sent = sum(state.remittances.filter((r) => r.fromId === id && leftHand(r)).map((r) => r.amount));
  return collected - sent;
}

export function pendingRemittances(state: TownState): Remittance[] {
  return state.remittances.filter((r) => r.status === "pending").sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function inTransit(state: TownState): number {
  return sum(pendingRemittances(state).map((r) => r.amount));
}

/** 主堡財庫：期初＋老闆自己收的＋確認過的繳回＋手記帳。 */
export function vaultBalance(state: TownState): number {
  const ownerCollected = sum(state.collections.filter((c) => memberOf(c.receiverId).isOwner).map((c) => c.amount));
  const confirmed = sum(state.remittances.filter((r) => r.status === "confirmed").map((r) => r.amount));
  return SETTINGS.openingBalance + ownerCollected + confirmed + sum(state.entries.map((e) => e.amount));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/**
 * 手上的錢最早是哪天收的（先進先出：繳回先抵掉最早的收款）。手上沒錢回 null。
 */
export function oldestUnsentDate(state: TownState, id: MemberId): string | null {
  if (holdingOf(state, id) <= 0) return null;
  let covered = sum(state.remittances.filter((r) => r.fromId === id && leftHand(r)).map((r) => r.amount));
  const mine = state.collections.filter((c) => c.receiverId === id).sort((a, b) => a.date.localeCompare(b.date));
  for (const c of mine) {
    if (covered >= c.amount) {
      covered -= c.amount;
      continue;
    }
    return c.date;
  }
  return null;
}

/** 手上的錢放了幾天；超過 SETTINGS.overdueDays 就是「N 天沒繳」。 */
export function heldDays(state: TownState, id: MemberId): number {
  const date = oldestUnsentDate(state, id);
  return date ? daysBetween(date, TODAY) : 0;
}

export function isOverdue(state: TownState, id: MemberId): boolean {
  return heldDays(state, id) > SETTINGS.overdueDays;
}

/** 最近一筆被退回、而且之後還沒再送的繳回（給背包泡泡標「被退回」）。 */
export function lastRejection(state: TownState, id: MemberId): Remittance | null {
  const mine = state.remittances.filter((r) => r.fromId === id && r.status !== "withdrawn");
  const last = mine[mine.length - 1];
  return last?.status === "rejected" ? last : null;
}

export interface CompanyMoney {
  vault: number;
  custody: number;
  transit: number;
  total: number;
  prepaid: number;
  payable: number;
  fund: number;
  loan: number;
  netWorth: number;
  /** 回本進度（暫定 = 水庫基金 ÷ 欠老闆的，style doc §8）。 */
  recovery: number;
}

/**
 * 公司的錢怎麼看（finance-plan §2）。預收、待發要第二步才算得出來，示意版用固定底數，
 * 再加減這次操作的：模擬收款算進預收；發薪、場地費、助教費從待發扣；其他支出從基金扣。
 */
export function companyMoney(state: TownState): CompanyMoney {
  const vault = vaultBalance(state);
  const custody = sum(CUSTODIANS.map((m) => holdingOf(state, m.id)));
  const transit = inTransit(state);
  const total = vault + custody + transit;
  const newEntries = state.entries.filter((e) => e.isNew);
  const prepaid = SETTINGS.prepaidBase + sum(state.collections.filter((c) => c.isNew).map((c) => c.amount));
  const paidOut = -sum(newEntries.filter((e) => ["venue", "assistant", "salary"].includes(e.category)).map((e) => e.amount));
  const payable = Math.max(0, SETTINGS.payableBase - paidOut);
  const loan = SETTINGS.loanBase + sum(newEntries.filter((e) => e.category === "loan").map((e) => e.amount));
  const fund = total - prepaid - payable;
  return {
    vault,
    custody,
    transit,
    total,
    prepaid,
    payable,
    fund,
    loan,
    netWorth: fund - loan,
    recovery: loan > 0 ? Math.min(1, Math.max(0, fund / loan)) : 1,
  };
}

/** 主堡倉庫要畫幾箱。 */
/** 「$1,200」「−$110,500」：負號在 $ 前面。 */
export function dollars(value: number): string {
  const text = `$${Math.round(Math.abs(value)).toLocaleString()}`;
  return value < 0 ? `−${text}` : text;
}

export function crateCount(vault: number): number {
  return Math.max(0, Math.round(vault / SETTINGS.crateUnit));
}

/** 這個月（TODAY 所在月份）主堡進出多少。 */
export function vaultMonthFlow(state: TownState): { inflow: number; outflow: number } {
  const month = TODAY.slice(0, 7);
  const ownerIn = state.collections.filter((c) => memberOf(c.receiverId).isOwner && c.date.startsWith(month)).map((c) => c.amount);
  const remitIn = state.remittances.filter((r) => r.status === "confirmed" && r.date.startsWith(month)).map((r) => r.amount);
  const entries = state.entries.filter((e) => e.date.startsWith(month));
  return {
    inflow: sum([...ownerIn, ...remitIn, ...entries.filter((e) => e.amount > 0).map((e) => e.amount)]),
    outflow: -sum(entries.filter((e) => e.amount < 0).map((e) => e.amount)),
  };
}

/** 某個地方的場地費、助教費，新的在上面。 */
export function placeEntries(state: TownState, place: Place): VaultEntry[] {
  return state.entries.filter((e) => e.place === place).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id, undefined, { numeric: true }));
}

/** 這個人所有送回主堡的紀錄（含退回、撤回），新的在上面。 */
export function remittancesOf(state: TownState, id: MemberId): Remittance[] {
  return state.remittances.filter((r) => r.fromId === id).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id, undefined, { numeric: true }));
}

export type LedgerScope = "vault" | "custody";

export interface LedgerRow {
  id: string;
  date: string;
  scope: LedgerScope;
  title: string;
  detail: string;
  amount: number;
  status?: RemitStatus;
}

/** 帳本模式的每一列，新的在上面。 */
export function ledgerRows(state: TownState): LedgerRow[] {
  const rows: LedgerRow[] = [];
  for (const c of state.collections) {
    const owner = memberOf(c.receiverId);
    rows.push({
      id: c.id,
      date: c.date,
      scope: owner.isOwner ? "vault" : "custody",
      title: owner.isOwner ? `老闆收款 · ${c.student}` : `${owner.name}代收 · ${c.student}`,
      detail: `${c.item} · ${c.method === "cash" ? "現金" : "轉帳"}`,
      amount: c.amount,
    });
  }
  for (const r of state.remittances) {
    rows.push({
      id: r.id,
      date: r.date,
      scope: r.status === "confirmed" ? "vault" : "custody",
      title: `${memberOf(r.fromId).name}送回主堡`,
      detail: [r.method === "cash" ? "現金" : `轉帳${r.ref ? ` · 末五碼 ${r.ref}` : ""}`, r.reason && `退回：${r.reason}`, r.note]
        .filter(Boolean)
        .join(" · "),
      amount: r.amount,
      status: r.status,
    });
  }
  for (const e of state.entries) {
    rows.push({
      id: e.id,
      date: e.date,
      scope: "vault",
      title: `${CATEGORY_LABELS[e.category]} · ${e.note}`,
      detail: [e.payee && (e.amount < 0 ? `付給 ${e.payee}` : e.payee), e.place && PLACES[e.place].short].filter(Boolean).join(" · "),
      amount: e.amount,
    });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id, undefined, { numeric: true }));
}

// ---------- 動作 ----------

export type TownAction =
  | { type: "collect"; receiverId: MemberId; student: string; item: string; amount: number; method: PayMethod }
  | { type: "remit"; fromId: MemberId; amount: number; method: PayMethod; ref?: string; note?: string; date: string }
  | { type: "withdraw"; id: string }
  | { type: "confirm"; id: string }
  | { type: "reject"; id: string; reason: string }
  | { type: "record"; category: EntryCategory; amount: number; payee?: string; note: string; place?: Place }
  | { type: "reset" };

/** 每個動作會產生的新資料 id（給畫面接動畫用）。 */
export function nextId(state: TownState, prefix: string): string {
  return `${prefix}${state.seq + 1}`;
}

export function townReducer(state: TownState, action: TownAction): TownState {
  switch (action.type) {
    case "collect":
      return {
        ...state,
        seq: state.seq + 1,
        collections: [
          ...state.collections,
          { id: nextId(state, "c"), date: TODAY, receiverId: action.receiverId, student: action.student, item: action.item, amount: action.amount, method: action.method, isNew: true },
        ],
      };
    case "remit":
      return {
        ...state,
        seq: state.seq + 1,
        remittances: [
          ...state.remittances,
          { id: nextId(state, "r"), fromId: action.fromId, amount: action.amount, method: action.method, ref: action.ref, note: action.note, date: action.date, status: "pending" },
        ],
      };
    case "withdraw":
    case "confirm":
    case "reject":
      return {
        ...state,
        remittances: state.remittances.map((r) =>
          r.id !== action.id || r.status !== "pending"
            ? r
            : action.type === "reject"
              ? { ...r, status: "rejected", reason: action.reason }
              : { ...r, status: action.type === "confirm" ? "confirmed" : "withdrawn" }
        ),
      };
    case "record": {
      const signed = action.category === "loan" ? Math.abs(action.amount) : -Math.abs(action.amount);
      return {
        ...state,
        seq: state.seq + 1,
        entries: [
          ...state.entries,
          {
            id: nextId(state, "e"),
            date: TODAY,
            category: action.category,
            amount: signed,
            payee: action.payee,
            note: action.note,
            place: PLACE_CATEGORIES.includes(action.category) ? action.place : undefined,
            isNew: true,
          },
        ],
      };
    }
    case "reset":
      return INITIAL_STATE;
  }
}

/** 送回主堡的金額檢查；沒問題回 null。 */
export function remitAmountError(amount: number, holding: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "請輸入要送回的金額";
  if (!Number.isInteger(amount)) return "金額要是整數";
  if (amount > holding) return `背包裡只有 $${holding.toLocaleString()}`;
  return null;
}
