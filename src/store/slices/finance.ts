import { api } from "../api";
import type { Allocation, SplitRule } from "@/domains/finance/types";
import type { Flow, Pile } from "@/domains/finance/flows";

// 財務輕量版（docs/finance-lite.md）。點名、收款、建卡都會改到每堂的錢，
// 所以那些 mutation 也要讓 "Finance" 失效——這裡用 Attendance／StudentCard 一起 provide。
const FINANCE_TAGS = ["Finance", "Attendance", "StudentCard", "Lesson"] as const;

export interface FinanceLocation {
  id: number;
  name: string;
  archivedAt: string | null;
  keeperUserId: number | null;
  financeStartAt: string | null;
}

export interface FinanceSettings {
  enabled: boolean;
  canManage: boolean;
  isAdmin: boolean;
  me: number;
  locations: FinanceLocation[];
  members: { userId: number; name: string; role: string }[];
}

export type PeriodWarning =
  | "NO_LOCATION"
  | "NOT_STARTED"
  | "NOT_TAKEN"
  | "NO_RULE"
  | "NO_CARD"
  | "CARD_UNPAID"
  | "DROPIN_UNPAID"
  | "CARD_NO_BRANCH"
  | "NO_PACK"
  | "NO_KEEPER";

export interface PeriodRecord {
  studentId: number;
  studentName: string;
  kind: "card" | "dropIn" | "none";
  studentCardId: number | null;
  serialNumber: number | null;
  amount: number;
  locationId: number;
  unpaid: boolean;
}

export interface PeriodFinance {
  periodId: number;
  lessonId: number;
  lessonName: string;
  startTime: string;
  lessonLocationId: number | null;
  counted: boolean;
  defaultPayerUserId: number | null;
  income: number;
  piles: Pile[];
  records: PeriodRecord[];
  ruleSource: "override" | "lesson" | "none";
  allocations: Allocation[];
  branchIncome: { locationId: number; amount: number }[];
  flows: Flow[];
  warnings: PeriodWarning[];
  settlement: { paidByUserId: number; payerLocationId: number; settledAt: string; changed: boolean } | null;
}

export interface LessonFinance {
  rule: SplitRule | null;
  overrides: { periodId: number; rule: SplitRule }[];
  periods: PeriodFinance[];
}

export interface FinanceVenue {
  id: number;
  name: string;
  landlordUserId: number | null;
  locationId: number | null;
  perSessionPrice: number | null;
  archivedAt: string | null;
}

export interface FinancePack {
  id: number;
  venueId: number;
  sessions: number;
  price: number;
  remainingAtStart: number | null;
  paidByUserId: number;
  purchasedAt: string;
  voidedAt: string | null;
  used: number;
}

export type BalanceFlow = { from: number; to: number; amount: number; reason: Flow["reason"] | "breakage" | "transfer" };

export type BalanceEntry =
  | { kind: "period"; date: string; periodId: number; lessonId: number; lessonName: string; flows: BalanceFlow[] }
  | {
      kind: "breakage";
      date: string;
      studentCardId: number;
      serialNumber: number;
      studentName: string;
      remainingSessions: number;
      flows: BalanceFlow[];
    }
  | { kind: "transfer"; date: string; transferId: number; note: string | null; flows: BalanceFlow[] };

export interface FinanceBalance {
  pairs: { from: number; to: number; amount: number }[];
  entries: BalanceEntry[];
  unsettled: { periodId: number; startTime: string; lessonId: number; lessonName: string; locationId: number | null }[];
}

const financeApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getFinanceSettings: builder.query<FinanceSettings, void>({
      query: () => "finance/settings",
      providesTags: ["Finance", "Location", "Membership"],
    }),
    updateFinanceLocation: builder.mutation<
      FinanceLocation,
      { id: number; keeperUserId?: number | null; financeStartDate?: string | null }
    >({
      query: ({ id, ...body }) => ({ url: `finance/locations/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Finance"],
    }),
    getLessonFinance: builder.query<LessonFinance, number>({
      query: (lessonId) => `finance/lessons/${lessonId}`,
      providesTags: [...FINANCE_TAGS],
    }),
    setLessonRule: builder.mutation<{ rule: SplitRule }, { lessonId: number; rule: SplitRule }>({
      query: ({ lessonId, rule }) => ({ url: `finance/lessons/${lessonId}`, method: "PUT", body: { rule } }),
      invalidatesTags: ["Finance"],
    }),
    setPeriodOverride: builder.mutation<
      { rule: SplitRule | null },
      { lessonId: number; periodId: number; rule: SplitRule | null }
    >({
      query: ({ lessonId, periodId, rule }) => ({
        url: `finance/lessons/${lessonId}/periods/${periodId}`,
        method: "PUT",
        body: { rule },
      }),
      invalidatesTags: ["Finance"],
    }),
    settlePeriod: builder.mutation<PeriodFinance, { periodId: number; paidByUserId?: number | null }>({
      query: ({ periodId, paidByUserId }) => ({
        url: `finance/periods/${periodId}/settle`,
        method: "POST",
        body: { paidByUserId: paidByUserId ?? null },
      }),
      invalidatesTags: ["Finance"],
    }),
    unsettlePeriod: builder.mutation<PeriodFinance, number>({
      query: (periodId) => ({ url: `finance/periods/${periodId}/settle`, method: "DELETE" }),
      invalidatesTags: ["Finance"],
    }),
    getFinanceVenues: builder.query<{ venues: FinanceVenue[] }, void>({
      query: () => "finance/venues",
      providesTags: ["Finance"],
    }),
    createVenue: builder.mutation<
      FinanceVenue,
      { name: string; locationId: number; landlordUserId?: number | null; perSessionPrice?: number | null }
    >({
      query: (body) => ({ url: "finance/venues", method: "POST", body }),
      invalidatesTags: ["Finance"],
    }),
    updateVenue: builder.mutation<
      FinanceVenue,
      {
        id: number;
        name?: string;
        locationId?: number;
        landlordUserId?: number | null;
        perSessionPrice?: number | null;
        archived?: boolean;
      }
    >({
      query: ({ id, ...body }) => ({ url: `finance/venues/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Finance"],
    }),
    deleteVenue: builder.mutation<{ success: true }, number>({
      query: (id) => ({ url: `finance/venues/${id}`, method: "DELETE" }),
      invalidatesTags: ["Finance"],
    }),
    getFinancePacks: builder.query<{ packs: FinancePack[] }, void>({
      query: () => "finance/packs",
      providesTags: ["Finance"],
    }),
    createPack: builder.mutation<
      FinancePack,
      { venueId: number; sessions: number; price: number; purchasedDate?: string; remainingAtStart?: number | null }
    >({
      query: (body) => ({ url: "finance/packs", method: "POST", body }),
      invalidatesTags: ["Finance"],
    }),
    voidPack: builder.mutation<FinancePack, number>({
      query: (id) => ({ url: `finance/packs/${id}`, method: "DELETE" }),
      invalidatesTags: ["Finance"],
    }),
    getFinanceBalance: builder.query<FinanceBalance, void>({
      query: () => "finance/balance",
      providesTags: [...FINANCE_TAGS],
    }),
    createTransfer: builder.mutation<
      unknown,
      { fromLocationId: number; toLocationId: number; amount: number; date?: string; note?: string | null }
    >({
      query: (body) => ({ url: "finance/transfers", method: "POST", body }),
      invalidatesTags: ["Finance"],
    }),
    voidTransfer: builder.mutation<unknown, number>({
      query: (id) => ({ url: `finance/transfers/${id}`, method: "DELETE" }),
      invalidatesTags: ["Finance"],
    }),
    updateCardBranches: builder.mutation<
      { id: number; moneyLocationId: number | null; homeLocationId: number | null },
      { id: number; moneyLocationId?: number | null; homeLocationId?: number | null }
    >({
      query: ({ id, ...body }) => ({ url: `finance/student-cards/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Finance", "StudentCard"],
    }),
  }),
});

export const {
  useGetFinanceSettingsQuery,
  useUpdateFinanceLocationMutation,
  useGetLessonFinanceQuery,
  useSetLessonRuleMutation,
  useSetPeriodOverrideMutation,
  useSettlePeriodMutation,
  useUnsettlePeriodMutation,
  useGetFinanceVenuesQuery,
  useCreateVenueMutation,
  useUpdateVenueMutation,
  useDeleteVenueMutation,
  useGetFinancePacksQuery,
  useCreatePackMutation,
  useVoidPackMutation,
  useGetFinanceBalanceQuery,
  useCreateTransferMutation,
  useVoidTransferMutation,
  useUpdateCardBranchesMutation,
} = financeApi;
