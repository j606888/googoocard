import { api } from "../api";
import type { EntryCategory } from "@/domains/finance/money";
import type { Quest } from "@/domains/finance/schemas";

/** 水庫（finance 模組）。所有 mutation 都讓整個水庫重抓：帳彼此牽動，分開算很容易漏。 */

export type FinanceUser = { id: number; name: string };
export type PaymentMethod = "CASH" | "TRANSFER";
export type RemittanceStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "WITHDRAWN";

export interface FinanceSettingState {
  setting: {
    revenueOwnerUserId: number | null;
    startDate: string | null;
    openingBalance: number;
    openingOwnerLoan: number | null;
    overdueDays: number;
    setupCompletedAt: string | null;
    openingCustody: { userId: number; amount: number }[];
  } | null;
  members: (FinanceUser & { role: string })[];
  canEdit: boolean;
  isRevenueOwner: boolean;
}

export interface SettingSummary {
  revenueOwner: FinanceUser | null;
  startDate: string;
  openingBalance: number;
  openingOwnerLoan: number | null;
  overdueDays: number;
}

export interface Remittance {
  id: number;
  from: FinanceUser;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  sentOn: string;
  note: string | null;
  status: RemittanceStatus;
  reviewedBy: FinanceUser | null;
  reviewedAt: string | null;
  rejectReason: string | null;
  createdAt: string;
}

export interface CardPayment {
  studentCardId: number;
  serial: string;
  studentId: number;
  studentName: string;
  cardName: string;
  amount: number;
  paidAt: string;
  method: PaymentMethod | null;
}

export interface HolderFigures {
  opening: number;
  collected: number;
  pending: number;
  confirmed: number;
  inHand: number;
  cardCount: number;
  heldSince: string | null;
  daysHeld: number;
  overdue: boolean;
  lastSentOn: string | null;
}

export interface Holder extends HolderFigures {
  user: FinanceUser;
  isMember: boolean;
}

export interface Overview {
  setting: SettingSummary;
  totals: {
    company: number;
    vault: number;
    inTransit: number;
    inHands: number;
    prepaid: number;
    prepaidSessions: number;
    other: number;
    ownerLoan: number | null;
    netWorth: number;
    ownerCollected: number;
    ownerCardCount: number;
  };
  holders: Holder[];
  pending: Remittance[];
  unknownCards: CardPayment[];
  members: FinanceUser[];
}

export type PassbookEntry =
  | { kind: "opening"; at: string; amount: number; balance: number }
  | ({ kind: "card"; at: string; balance: number } & CardPayment)
  | ({ kind: "remittance"; at: string; balance: number } & Remittance);

export interface Passbook {
  user: FinanceUser;
  isRevenueOwner: boolean;
  setting: SettingSummary;
  figures: HolderFigures;
  entries: PassbookEntry[];
}

export interface VaultEntryRow {
  kind: "entry";
  at: string;
  id: number;
  date: string;
  category: EntryCategory;
  amount: number;
  signed: number;
  payee: FinanceUser | null;
  payeeName: string | null;
  description: string | null;
  createdBy: FinanceUser;
  voidedAt: string | null;
  revisionCount: number;
  balance: number;
}

export type VaultRow =
  | { kind: "opening"; at: string; amount: number; balance: number }
  | ({ kind: "card"; at: string; balance: number } & CardPayment)
  | ({ kind: "remittance"; at: string; balance: number } & Remittance)
  | VaultEntryRow;

export interface VaultLedger {
  setting: SettingSummary;
  vault: number;
  ownerLoan: number | null;
  entries: VaultRow[];
  members: FinanceUser[];
}

export interface Revision {
  id: number;
  reason: string;
  before: Record<string, unknown>;
  after: Record<string, unknown> | null;
  createdAt: string;
  editedBy: FinanceUser;
}

export interface QuestItem {
  key: string;
  label: string;
  hint?: string;
  done: boolean;
  roles: ("owner" | "revenueOwner" | "holder")[];
}

export interface Quests {
  roles: ("owner" | "revenueOwner" | "holder")[];
  quests: QuestItem[];
  allDone: boolean;
}

export interface SetupBody {
  revenueOwnerUserId: number;
  startDate: string;
  openingBalance: number;
  openingOwnerLoan: number | null;
  openingCustody: { userId: number; amount: number }[];
}

export interface RemittanceBody {
  amount: number;
  method: PaymentMethod;
  reference?: string | null;
  sentOn: string;
  note?: string | null;
}

export interface EntryBody {
  date: string;
  category: EntryCategory;
  amount: number;
  payeeUserId?: number | null;
  payeeName?: string | null;
  description?: string | null;
}

// ---------- 第二步：分帳規則、每堂驗收（src/service/finance/split.ts）

export type TeacherPay = "NONE" | "HOURLY" | "SPLIT";
export type FeeMode = "NONE" | "PER_LESSON" | "PER_DAY";
export type VenuePayee = "MEMBER" | "EXTERNAL";
export type RemainderTo = "REVENUE_OWNER" | "FUND";
export type RuleScope = "CLASSROOM" | "LOCATION" | "LESSON";

export interface SplitRuleKnobs {
  teacherPay?: TeacherPay | null;
  hourlyFee?: number | null;
  venueMode?: FeeMode | null;
  venueAmount?: number | null;
  venuePayee?: VenuePayee | null;
  venueTeacherId?: number | null;
  assistantMode?: FeeMode | null;
  assistantAmount?: number | null;
  commissionPct?: number | null;
  manual?: boolean | null;
  roundTo?: 1 | 10 | 100 | null;
  remainderTo?: RemainderTo | null;
  shares?: { teacherId: number; pct: number }[];
}

export interface SplitRuleRow extends SplitRuleKnobs {
  id: number;
  scope: RuleScope;
  locationId: number | null;
  lessonId: number | null;
  effectiveFrom: string;
  reason: string | null;
  createdAt: string;
}

export interface SplitRuleBody extends SplitRuleKnobs {
  scope: RuleScope;
  locationId?: number | null;
  lessonId?: number | null;
  applyFrom?: "THIS_MONTH" | "NEXT_MONTH";
  reason?: string | null;
}

export type SplitFlag = "NO_CARD" | "MISSING_SHARE_TEACHER" | "NO_TEACHER" | "MANUAL" | "NO_LOCATION";
export type LessonSplitStatus = "UPCOMING" | "NOT_TAKEN" | "PENDING" | "CHANGED" | "VERIFIED";

export interface LessonSplitRow {
  periodId: number;
  lessonId: number;
  lessonName: string;
  startTime: string;
  dateKey: string;
  locationId: number | null;
  attendeeCount: number;
  status: LessonSplitStatus;
  flags: SplitFlag[];
  split: {
    revenue: number;
    estimated: number;
    venueFee: number;
    venueTeacherId: number | null;
    assistantFee: number;
    assistantLines: { teacherId: number; amount: number }[];
    commission: number;
    teacherLines: { teacherId: number; amount: number }[];
    remainder: number;
    remainderTeacherId: number | null;
    fund: number;
  } | null;
  verified: {
    by: { id: number; name: string };
    at: string;
    revenue: number;
    revenueDiff: number;
    lines: { kind: "TEACHER" | "VENUE" | "ASSISTANT" | "REMAINDER"; teacherId: number | null; amount: number }[];
    fund: number;
    overridden: boolean;
    overrideReason: string | null;
  } | null;
}

export interface DayBook {
  date: string;
  lessons: LessonSplitRow[];
  distribution: {
    revenue: number;
    fund: number;
    externalVenue: number;
    people: { teacherId: number; teach: number; venue: number; assistant: number; remainder: number; total: number }[];
  };
  vault: {
    rows: { kind: "entry" | "card" | "remittance"; label: string; category: string | null; amount: number; by: string | null; voided: boolean }[];
    balance: number | null;
  };
  custody: { studentCardId: number; label: string; amount: number; holder: { id: number; name: string } | null }[];
}

const TAG = [{ type: "Finance" as const }];

export const financeApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getFinanceSetting: builder.query<FinanceSettingState, void>({ query: () => "finance/setting", providesTags: TAG }),
    getFinanceOverview: builder.query<Overview, void>({ query: () => "finance/overview", providesTags: TAG }),
    getHolderPassbook: builder.query<Passbook, number>({ query: (userId) => `finance/holders/${userId}`, providesTags: TAG }),
    getVaultLedger: builder.query<VaultLedger, void>({ query: () => "finance/vault", providesTags: TAG }),
    getEntryHistory: builder.query<Revision[], number>({ query: (id) => `finance/entries/${id}/history`, providesTags: TAG }),
    getSettingHistory: builder.query<Revision[], void>({ query: () => "finance/setting/history", providesTags: TAG }),
    getFinanceQuests: builder.query<Quests, void>({ query: () => "finance/quests", providesTags: TAG }),

    setRevenueOwner: builder.mutation<unknown, number>({
      query: (revenueOwnerUserId) => ({ url: "finance/setting/revenue-owner", method: "PUT", body: { revenueOwnerUserId } }),
      invalidatesTags: TAG,
    }),
    setupFinance: builder.mutation<unknown, SetupBody>({
      query: (body) => ({ url: "finance/setup", method: "POST", body }),
      invalidatesTags: TAG,
    }),
    patchFinanceSetting: builder.mutation<
      unknown,
      { revenueOwnerUserId?: number; openingBalance?: number; openingOwnerLoan?: number | null; overdueDays?: number; reason?: string }
    >({
      query: (body) => ({ url: "finance/setting", method: "PATCH", body }),
      invalidatesTags: TAG,
    }),
    createRemittance: builder.mutation<unknown, RemittanceBody>({
      query: (body) => ({ url: "finance/remittances", method: "POST", body }),
      invalidatesTags: TAG,
    }),
    updateRemittance: builder.mutation<unknown, { id: number; body: RemittanceBody }>({
      query: ({ id, body }) => ({ url: `finance/remittances/${id}`, method: "PATCH", body }),
      invalidatesTags: TAG,
    }),
    withdrawRemittance: builder.mutation<unknown, number>({
      query: (id) => ({ url: `finance/remittances/${id}/withdraw`, method: "POST" }),
      invalidatesTags: TAG,
    }),
    confirmRemittance: builder.mutation<unknown, number>({
      query: (id) => ({ url: `finance/remittances/${id}/confirm`, method: "POST" }),
      invalidatesTags: TAG,
    }),
    rejectRemittance: builder.mutation<unknown, { id: number; reason: string }>({
      query: ({ id, reason }) => ({ url: `finance/remittances/${id}/reject`, method: "POST", body: { reason } }),
      invalidatesTags: TAG,
    }),
    createEntry: builder.mutation<unknown, EntryBody>({
      query: (body) => ({ url: "finance/entries", method: "POST", body }),
      invalidatesTags: TAG,
    }),
    updateEntry: builder.mutation<unknown, { id: number; entry: EntryBody; reason: string }>({
      query: ({ id, entry, reason }) => ({ url: `finance/entries/${id}`, method: "PATCH", body: { entry, reason } }),
      invalidatesTags: TAG,
    }),
    voidEntry: builder.mutation<unknown, { id: number; reason: string }>({
      query: ({ id, reason }) => ({ url: `finance/entries/${id}/void`, method: "POST", body: { reason } }),
      invalidatesTags: TAG,
    }),
    getLessonSplits: builder.query<LessonSplitRow[], { from: string; to: string }>({
      query: ({ from, to }) => `finance/lessons?from=${from}&to=${to}`,
      providesTags: TAG,
    }),
    verifyLessons: builder.mutation<
      { verified: number[]; skipped: { periodId: number; reason: string }[] },
      { periodIds: number[]; batch?: boolean }
    >({
      query: (body) => ({ url: "finance/lessons/verify", method: "POST", body }),
      invalidatesTags: TAG,
    }),
    overrideLesson: builder.mutation<unknown, { periodId: number; teacherLines: { teacherId: number; amount: number }[]; reason: string }>({
      query: ({ periodId, ...body }) => ({ url: `finance/lessons/${periodId}/override`, method: "POST", body }),
      invalidatesTags: TAG,
    }),
    getDayBook: builder.query<DayBook, string>({ query: (date) => `finance/day?date=${date}`, providesTags: TAG }),
    getSplitRules: builder.query<SplitRuleRow[], void>({ query: () => "finance/split-rules", providesTags: TAG }),
    saveSplitRule: builder.mutation<SplitRuleRow, SplitRuleBody>({
      query: (body) => ({ url: "finance/split-rules", method: "PUT", body }),
      invalidatesTags: TAG,
    }),
    markFinanceQuest: builder.mutation<unknown, Quest>({
      query: (quest) => ({ url: "finance/quests", method: "POST", body: { quest } }),
      invalidatesTags: TAG,
    }),
  }),
});

export const {
  useGetFinanceSettingQuery,
  useGetFinanceOverviewQuery,
  useGetHolderPassbookQuery,
  useGetVaultLedgerQuery,
  useGetEntryHistoryQuery,
  useGetSettingHistoryQuery,
  useGetFinanceQuestsQuery,
  useSetRevenueOwnerMutation,
  useSetupFinanceMutation,
  usePatchFinanceSettingMutation,
  useCreateRemittanceMutation,
  useUpdateRemittanceMutation,
  useWithdrawRemittanceMutation,
  useConfirmRemittanceMutation,
  useRejectRemittanceMutation,
  useCreateEntryMutation,
  useUpdateEntryMutation,
  useVoidEntryMutation,
  useMarkFinanceQuestMutation,
  useGetLessonSplitsQuery,
  useVerifyLessonsMutation,
  useOverrideLessonMutation,
  useGetDayBookQuery,
  useGetSplitRulesQuery,
  useSaveSplitRuleMutation,
} = financeApi;

/** RTK Query 錯誤裡的 API code。 */
export function financeErrorCode(error: unknown): string | undefined {
  return (error as { data?: { code?: string } })?.data?.code;
}
