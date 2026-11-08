import { api } from "../api";
import type { SplitRule } from "@/domains/finance/types";
import type { PeriodFinance as PeriodFinanceServer } from "@/service/finance/periods";

export interface FinanceSettings {
  enabled: boolean;
  launchDate: string | null;
  roundTo: number;
  legacyCustodianUserId: number | null;
  /** 開帳清單「場地」：這間教室不用場地費。 */
  noVenueFee: boolean;
  members: { userId: number; name: string; isCustodian: boolean; canSettle: boolean }[];
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
  moneyAccountId?: number;
  isAdvance?: boolean;
}

export type PackInput =
  | { venueId: number; sessions: number; price: number; paidByUserId: number; purchasedAt: string }
  /** 開帳：上線前買的包、還剩 remaining 次（價值＝包價 ÷ 總次數 × 剩下次數）。 */
  | { venueId: number; paidByUserId: number; before: { totalSessions: number; totalPrice: number; remaining: number } };

export type ChecklistKey =
  | "branches"
  | "lessonBranches"
  | "teachers"
  | "venues"
  | "rules"
  | "receivers"
  | "opening";

export interface SetupResponse {
  items: { key: ChecklistKey; done: boolean; detail?: string; links?: { label: string; href: string }[] }[];
  /** 進行中的課（開帳精靈第 2、5 步）。 */
  lessons: { id: number; name: string; locationId: number | null; hasRule: boolean }[];
  complete: boolean;
}

/** GET /finance/receivers — 上線後收款人不是保管人的錢（開帳整理一次）。 */
export interface StrayReceiverItem {
  kind: "card" | "dropIn";
  id: number;
  studentName: string;
  label: string;
  amount: number;
  /** 台北日期 YYYY-MM-DD */
  date: string;
  receiverUserId: number;
  receiverName: string;
}

export interface FinanceLocation {
  id: number;
  name: string;
  keeperUserId: number | null;
  expiryTo: "FUND" | "USER";
  expiryUserId: number | null;
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
  /** 付款人在老師名單裡有同名、沒連帳號的老師 →「這位老師是 X 本人嗎？」 */
  linkSuggestion: { userId: number; name: string } | null;
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
      { roundTo?: 1 | 10 | 100; legacyCustodianUserId?: number; noVenueFee?: boolean }
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
    getRuledLessons: builder.query<{ lessons: { id: number; name: string }[] }, void>({
      query: () => "finance/lessons",
      providesTags: ["Finance", "Lesson"],
    }),
    setLessonLocation: builder.mutation<unknown, { id: number; locationId: number }>({
      query: ({ id, locationId }) => ({ url: `finance/lessons/${id}/location`, method: "PATCH", body: { locationId } }),
      invalidatesTags: ["Finance", "Lesson"],
    }),
    getStrayReceivers: builder.query<{ items: StrayReceiverItem[] }, void>({
      query: () => "finance/receivers",
      providesTags: ["Finance", "Membership", "StudentCard"],
    }),
    reassignStrayReceivers: builder.mutation<
      { cards: number; dropIns: number },
      { toUserId: number; cardIds: number[]; dropInIds: number[] }
    >({
      query: (body) => ({ url: "finance/receivers", method: "POST", body }),
      invalidatesTags: ["Finance", "StudentCard"],
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
    linkFinanceTeacher: builder.mutation<unknown, { id: number; userId: number }>({
      query: ({ id, userId }) => ({ url: `finance/teachers/${id}/link`, method: "POST", body: { userId } }),
      invalidatesTags: ["Finance", "Teacher", "Membership"],
    }),
    getFinanceSettings: builder.query<FinanceSettings, void>({
      query: () => "finance/settings",
      providesTags: ["Classroom", "Membership"],
    }),
    getFinancePacks: builder.query<{ packs: FinancePack[] }, void>({
      query: () => "finance/packs",
      providesTags: ["Finance"],
    }),
    getFinanceVenues: builder.query<{ venues: FinanceVenue[] }, void>({
      query: () => "finance/venues",
      providesTags: ["Finance"],
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
  useGetRuledLessonsQuery,
  useSetLessonLocationMutation,
  useGetStrayReceiversQuery,
  useReassignStrayReceiversMutation,
  useCreateFinanceVenueMutation,
  useUpdateFinanceVenueMutation,
  useGetFinanceTeachersQuery,
  useSetTeacherPayerMutation,
  useLinkFinanceTeacherMutation,
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
  useGetFinanceVenuesQuery,
  useGetFinancePacksQuery,
} = financeApi;
