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
  members: {
    userId: number;
    name: string;
    /** `Membership.role`（`src/lib/roles.ts`）。 */
    role: string;
    /** 連結到這位成員的老師名字（`Teacher.userId`），沒有就是 null。 */
    teacherName: string | null;
    isCustodian: boolean;
    canSettle: boolean;
  }[];
}

export interface FinanceVenue {
  id: number;
  name: string;
  /** 場地的分部：場地費和次數包從這個分部負責人的錢付。 */
  locationId: number | null;
  landlordUserId: number | null;
  /** 有值＝每次付這麼多；null＝買次數包。 */
  perSessionPrice: number | null;
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
  /** 先買先用、已經用掉幾次（還沒開帳 → 0）。 */
  used: number;
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

/** 付款人不用給：是場地分部的負責人。 */
export type PackInput =
  | { venueId: number; sessions: number; price: number; purchasedAt: string }
  /** 開帳：上線前買的包、還剩 remaining 次（價值＝包價 ÷ 總次數 × 剩下次數）。 */
  | { venueId: number; before: { totalSessions: number; totalPrice: number; remaining: number } };

export type VenueInput = {
  name: string;
  locationId: number;
  landlordUserId: number | null;
  perSessionPrice: number | null;
};

export type ChecklistKey =
  | "branches"
  | "lessonBranches"
  | "venues"
  | "rules"
  | "receivers"
  | "cash"
  | "payables"
  | "opening";

export interface SetupResponse {
  items: { key: ChecklistKey; done: boolean; detail?: string; links?: { label: string; href: string }[] }[];
  /** 進行中的課（開帳精靈第 2、4 步）。 */
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
  /** 之前改記過：第一位實際收錢的人 */
  collectedByName: string | null;
}

/** 開帳整理改記過的一筆：原收款人 → 現在的保管人（可復原）。 */
export interface ReassignedReceiverItem {
  kind: "card" | "dropIn";
  id: number;
  studentName: string;
  label: string;
  amount: number;
  /** 台北日期 YYYY-MM-DD */
  date: string;
  collectedByUserId: number;
  collectedByName: string;
  holderUserId: number;
  holderName: string;
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
  /** 沒連帳號的老師，跟某位還沒連老師的成員同名 →「這位老師是 X 本人嗎？」 */
  linkSuggestion: { userId: number; name: string } | null;
}

const financeApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getFinanceSetup: builder.query<SetupResponse, void>({
      query: () => "finance/setup",
      providesTags: ["Finance", "Lesson", "Teacher", "Location"],
    }),
    enableFinance: builder.mutation<unknown, { legacyCustodianUserId: number }>({
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
    getStrayReceivers: builder.query<{ items: StrayReceiverItem[]; reassigned: ReassignedReceiverItem[] }, void>({
      query: () => "finance/receivers",
      providesTags: ["Finance", "Membership", "StudentCard"],
    }),
    reassignStrayReceivers: builder.mutation<
      { cards: number; dropIns: number },
      { moves: { toUserId: number; cardIds: number[]; dropInIds: number[] }[]; conversionDate?: string }
    >({
      query: (body) => ({ url: "finance/receivers", method: "POST", body }),
      invalidatesTags: ["Finance", "StudentCard"],
    }),
    restoreStrayReceivers: builder.mutation<{ cards: number; dropIns: number }, { cardIds: number[]; dropInIds: number[] }>({
      query: (body) => ({ url: "finance/receivers/restore", method: "POST", body }),
      invalidatesTags: ["Finance", "StudentCard"],
    }),
    createFinanceVenue: builder.mutation<FinanceVenue, VenueInput>({
      query: (body) => ({ url: "finance/venues", method: "POST", body }),
      invalidatesTags: ["Finance"],
    }),
    updateFinanceVenue: builder.mutation<
      unknown,
      { id: number; archived?: boolean } & Partial<VenueInput>
    >({
      query: ({ id, ...body }) => ({ url: `finance/venues/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Finance"],
    }),
    deleteFinanceVenue: builder.mutation<unknown, number>({
      query: (id) => ({ url: `finance/venues/${id}`, method: "DELETE" }),
      invalidatesTags: ["Finance"],
    }),
    getFinanceTeachers: builder.query<{ teachers: FinanceTeacher[] }, void>({
      query: () => "finance/teachers",
      providesTags: ["Finance", "Teacher"],
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
  useRestoreStrayReceiversMutation,
  useCreateFinanceVenueMutation,
  useUpdateFinanceVenueMutation,
  useDeleteFinanceVenueMutation,
  useGetFinanceTeachersQuery,
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
