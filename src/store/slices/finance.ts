import { api } from "../api";
import type { SplitRule } from "@/domains/finance/types";
import type { PeriodFinance as PeriodFinanceServer } from "@/service/finance/periods";
import type { CustodyUser, CustodyWarning } from "@/service/finance/custody";
import type { MonthStatement as MonthStatementServer } from "@/service/finance/settlement";
import type { Todos } from "./todos";

export interface FinanceSettings {
  enabled: boolean;
  launchDate: string | null;
  roundTo: number;
  legacyCustodianUserId: number | null;
  members: { userId: number; name: string; isCustodian: boolean; canSettle: boolean }[];
}

export interface CustodyResponse {
  users: CustodyUser[];
  warnings: CustodyWarning[];
}

export interface SettlementMonths {
  /** 最早沒鎖的月份 YYYY-MM */
  openMonth: string;
  months: { month: string; locked: boolean; lockedAt: string | null; lockedById: number | null }[];
}

export interface FinanceVenue {
  id: number;
  name: string;
  landlordUserId: number | null;
  archivedAt: string | null;
}

export interface FinancePack {
  id: number;
  venueId: number;
  sessions: number;
  price: number;
  paidByUserId: number;
  purchasedAt: string;
  voidedAt: string | null;
}

/** GET /finance/periods — dates arrive as ISO strings. */
export type PeriodFinance = Omit<PeriodFinanceServer, "startTime"> & { startTime: string };

/** GET /finance/settlements/[month] — dates arrive as ISO strings. */
export type MonthStatement = Omit<MonthStatementServer, "periods" | "expiries"> & {
  periods: PeriodFinance[];
  expiries: (Omit<MonthStatementServer["expiries"][number], "date"> & { date: string })[];
};

type Scoped = { locationId: number | null };

/** GET /finance/home — 財務首頁「要處理的事」。`locationId` = 這堂課的基金；null = 每個分部都看得到。 */
export interface FinanceHomeData {
  myLocationId: number | null;
  branches: { id: number; name: string }[];
  unsettledMonth: string | null;
  unpaidCards: (Todos["unpaidCards"][number] & Scoped)[];
  unpaidDropIns: (Todos["unpaidDropIns"][number] & Scoped)[];
  unboundAttendance: (Todos["unboundAttendance"][number] & Scoped)[];
  unsplitLessons: ({ lessonId: number; lessonName: string } & Scoped)[];
  uncheckedPeriods: ({ periodId: number; lessonId: number; lessonName: string; startTime: string } & Scoped)[];
  exhaustedPacks: ({ venueId: number; venueName: string; overdrawn: number } & Scoped)[];
}

export type TransferKind = "USER" | "TEACHER" | "SELF" | "VENUE";

export interface FinanceTransfer {
  id: number;
  date: string;
  amount: number;
  fromUserId: number;
  toKind: TransferKind;
  toUserId: number | null;
  toTeacherId: number | null;
  toVenueId: number | null;
  settlementMonth: string | null;
  note: string | null;
}

export interface TransferInput {
  date: string;
  amount: number;
  fromUserId: number;
  toKind: TransferKind;
  toUserId?: number;
  toTeacherId?: number;
  toVenueId?: number;
  settlementMonth?: string;
  note?: string;
}

export interface FinanceExpense {
  id: number;
  date: string;
  amount: number;
  locationId: number;
  category: string;
  paidByUserId: number;
  note: string | null;
}

export interface ExpenseInput {
  date: string;
  amount: number;
  locationId: number;
  category: string;
  paidByUserId: number;
  note?: string;
}

export interface PackInput {
  venueId: number;
  sessions: number;
  price: number;
  paidByUserId: number;
  purchasedAt: string;
}

export type ChecklistKey =
  | "branches"
  | "lessonBranches"
  | "teachers"
  | "venues"
  | "rules"
  | "funds"
  | "legacyPrepaid";

export interface SetupResponse {
  items: { key: ChecklistKey; done: boolean; detail?: string }[];
  complete: boolean;
}

export interface FinanceLocation {
  id: number;
  name: string;
  keeperUserId: number | null;
  expiryTo: "FUND" | "USER";
  expiryUserId: number | null;
  fundOpening: number;
  fundOpeningConfirmedAt: string | null;
}

export interface FinanceLocationPatch {
  keeperUserId?: number | null;
  expiryTo?: "FUND" | "USER";
  expiryUserId?: number | null;
}

export interface FinanceTeacher {
  id: number;
  name: string;
  userId: number | null;
  payerUserId: number | null;
}

const financeApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getFinanceSetup: builder.query<SetupResponse, void>({
      query: () => "finance/setup",
      providesTags: ["Finance", "Lesson", "Teacher", "Location"],
    }),
    enableFinance: builder.mutation<unknown, { launchDate: string; legacyCustodianUserId: number }>({
      query: (body) => ({ url: "finance/enable", method: "POST", body }),
      invalidatesTags: ["Classroom", "Membership", "Finance"],
    }),
    updateFinanceSettings: builder.mutation<
      unknown,
      { roundTo?: 1 | 10 | 100; legacyCustodianUserId?: number }
    >({
      query: (body) => ({ url: "finance/settings", method: "PATCH", body }),
      invalidatesTags: ["Classroom", "Finance"],
    }),
    setMemberFinance: builder.mutation<unknown, { userId: number; isCustodian?: boolean; canSettle?: boolean }>({
      query: ({ userId, ...body }) => ({ url: `finance/members/${userId}`, method: "PATCH", body }),
      invalidatesTags: ["Membership", "Classroom", "Finance"],
    }),
    getFinanceLocations: builder.query<{ locations: FinanceLocation[] }, void>({
      query: () => "finance/locations",
      providesTags: ["Finance", "Location"],
    }),
    updateFinanceLocation: builder.mutation<unknown, { id: number } & FinanceLocationPatch>({
      query: ({ id, ...body }) => ({ url: `finance/locations/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Finance"],
    }),
    confirmFundOpening: builder.mutation<unknown, { id: number; fundOpening: number }>({
      query: ({ id, fundOpening }) => ({
        url: `finance/locations/${id}/confirm-opening`,
        method: "POST",
        body: { fundOpening },
      }),
      invalidatesTags: ["Finance"],
    }),
    confirmLegacyPrepaid: builder.mutation<unknown, void>({
      query: () => ({ url: "finance/legacy-prepaid/confirm", method: "POST" }),
      invalidatesTags: ["Finance"],
    }),
    createFinanceVenue: builder.mutation<unknown, { name: string; landlordUserId?: number | null }>({
      query: (body) => ({ url: "finance/venues", method: "POST", body }),
      invalidatesTags: ["Finance"],
    }),
    updateFinanceVenue: builder.mutation<
      unknown,
      { id: number; name?: string; landlordUserId?: number | null; archived?: boolean }
    >({
      query: ({ id, ...body }) => ({ url: `finance/venues/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Finance"],
    }),
    getFinanceTeachers: builder.query<{ teachers: FinanceTeacher[] }, void>({
      query: () => "finance/teachers",
      providesTags: ["Finance", "Teacher"],
    }),
    setTeacherPayer: builder.mutation<unknown, { id: number; payerUserId: number | null }>({
      query: ({ id, payerUserId }) => ({ url: `finance/teachers/${id}`, method: "PATCH", body: { payerUserId } }),
      invalidatesTags: ["Finance"],
    }),
    getFinanceSettings: builder.query<FinanceSettings, void>({
      query: () => "finance/settings",
      providesTags: ["Classroom", "Membership"],
    }),
    getFinanceHome: builder.query<FinanceHomeData, void>({
      query: () => "finance/home",
      // 跟待處理同一份資料：收款、點名、補卡都會改變它。
      providesTags: ["Finance", "Lesson", "Student", "StudentCard", "AttendanceRecord"],
    }),
    getCustody: builder.query<CustodyResponse, { through?: string } | void>({
      query: (arg) => (arg && arg.through ? `finance/custody?through=${arg.through}` : "finance/custody"),
      providesTags: ["Finance"],
    }),
    getSettlementMonths: builder.query<SettlementMonths, void>({
      query: () => "finance/settlements",
      providesTags: ["Finance"],
    }),
    getFinancePacks: builder.query<{ packs: FinancePack[] }, void>({
      query: () => "finance/packs",
      providesTags: ["Finance"],
    }),
    getFinanceVenues: builder.query<{ venues: FinanceVenue[] }, void>({
      query: () => "finance/venues",
      providesTags: ["Finance"],
    }),
    getMonthStatement: builder.query<MonthStatement, string>({
      query: (month) => `finance/settlements/${month}`,
      providesTags: ["Finance"],
    }),
    lockMonth: builder.mutation<MonthStatement, string>({
      query: (month) => ({ url: `finance/settlements/${month}`, method: "POST" }),
      invalidatesTags: ["Finance"],
    }),
    getFinanceTransfers: builder.query<{ transfers: FinanceTransfer[] }, void>({
      query: () => "finance/transfers",
      providesTags: ["Finance"],
    }),
    createTransfer: builder.mutation<unknown, TransferInput>({
      query: (body) => ({ url: "finance/transfers", method: "POST", body }),
      invalidatesTags: ["Finance"],
    }),
    deleteTransfer: builder.mutation<unknown, number>({
      query: (id) => ({ url: `finance/transfers/${id}`, method: "DELETE" }),
      invalidatesTags: ["Finance"],
    }),
    getFinanceExpenses: builder.query<{ expenses: FinanceExpense[] }, string>({
      query: (month) => `finance/expenses?month=${month}`,
      providesTags: ["Finance"],
    }),
    createExpense: builder.mutation<unknown, ExpenseInput>({
      query: (body) => ({ url: "finance/expenses", method: "POST", body }),
      invalidatesTags: ["Finance"],
    }),
    deleteExpense: builder.mutation<unknown, number>({
      query: (id) => ({ url: `finance/expenses/${id}`, method: "DELETE" }),
      invalidatesTags: ["Finance"],
    }),
    createPack: builder.mutation<unknown, PackInput>({
      query: (body) => ({ url: "finance/packs", method: "POST", body }),
      invalidatesTags: ["Finance"],
    }),
    deletePack: builder.mutation<unknown, number>({
      query: (id) => ({ url: `finance/packs/${id}`, method: "DELETE" }),
      invalidatesTags: ["Finance"],
    }),
    refundCard: builder.mutation<
      unknown,
      { studentCardId: number; amount: number; paidByUserId: number; date: string }
    >({
      query: (body) => ({ url: "finance/refunds", method: "POST", body }),
      invalidatesTags: ["StudentCard", "Student", "Finance"],
    }),
    getLessonRule: builder.query<{ rule: SplitRule | null }, number>({
      query: (lessonId) => `finance/lessons/${lessonId}/rule`,
      providesTags: ["Finance"],
    }),
    saveLessonRule: builder.mutation<unknown, { lessonId: number; rule: SplitRule }>({
      query: ({ lessonId, rule }) => ({ url: `finance/lessons/${lessonId}/rule`, method: "PUT", body: rule }),
      invalidatesTags: ["Finance"],
    }),
    copyLessonRule: builder.mutation<unknown, { lessonId: number; fromLessonId: number }>({
      query: ({ lessonId, fromLessonId }) => ({
        url: `finance/lessons/${lessonId}/rule/copy`,
        method: "POST",
        body: { fromLessonId },
      }),
      invalidatesTags: ["Finance"],
    }),
    getLessonPeriodFinance: builder.query<PeriodFinance[], number>({
      query: (lessonId) => `finance/periods?lessonId=${lessonId}`,
      providesTags: ["Finance", "Attendance", "AttendanceRecord", "StudentCard"],
    }),
    getPeriodRule: builder.query<{ rule: SplitRule | null }, number>({
      query: (periodId) => `finance/periods/${periodId}/rule`,
      providesTags: ["Finance"],
    }),
    savePeriodRule: builder.mutation<unknown, { periodId: number; rule: SplitRule }>({
      query: ({ periodId, rule }) => ({ url: `finance/periods/${periodId}/rule`, method: "PUT", body: rule }),
      invalidatesTags: ["Finance"],
    }),
    deletePeriodRule: builder.mutation<unknown, { periodId: number }>({
      query: ({ periodId }) => ({ url: `finance/periods/${periodId}/rule`, method: "DELETE" }),
      invalidatesTags: ["Finance"],
    }),
  }),
});

export const {
  useGetFinanceSetupQuery,
  useEnableFinanceMutation,
  useUpdateFinanceSettingsMutation,
  useSetMemberFinanceMutation,
  useGetFinanceLocationsQuery,
  useUpdateFinanceLocationMutation,
  useConfirmFundOpeningMutation,
  useConfirmLegacyPrepaidMutation,
  useCreateFinanceVenueMutation,
  useUpdateFinanceVenueMutation,
  useGetFinanceTeachersQuery,
  useSetTeacherPayerMutation,
  useGetMonthStatementQuery,
  useGetFinanceHomeQuery,
  useLockMonthMutation,
  useGetFinanceTransfersQuery,
  useCreateTransferMutation,
  useDeleteTransferMutation,
  useGetFinanceExpensesQuery,
  useCreateExpenseMutation,
  useDeleteExpenseMutation,
  useCreatePackMutation,
  useDeletePackMutation,
  useRefundCardMutation,
  useGetLessonRuleQuery,
  useSaveLessonRuleMutation,
  useCopyLessonRuleMutation,
  useGetLessonPeriodFinanceQuery,
  useSavePeriodRuleMutation,
  useLazyGetPeriodRuleQuery,
  useDeletePeriodRuleMutation,
  useGetFinanceSettingsQuery,
  useGetCustodyQuery,
  useGetSettlementMonthsQuery,
  useGetFinanceVenuesQuery,
  useGetFinancePacksQuery,
} = financeApi;
