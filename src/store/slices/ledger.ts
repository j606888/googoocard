import { api } from "../api";
import type { ReportName } from "@/service/ledger/reports";
import type { financeOverview, teacherStatement } from "@/service/ledger/overview";
import type { getPayoutRun } from "@/service/ledger/payouts";
import type { listMoneyAccounts, getEntry } from "@/service/ledger/records";
import type { getCloseChecklist, getLockState } from "@/service/ledger/close";
import type { OpeningParams, OpeningPreview } from "@/service/ledger/opening";

// 財務 v2 總帳（docs/finance-v2/）。金額單位一律「分」，畫面換算成元。
// 伺服器回傳的 Date 經過 JSON 都會變成字串。
type Jsonify<T> = T extends Date ? string : T extends (infer U)[] ? Jsonify<U>[] : T extends object ? { [K in keyof T]: Jsonify<T[K]> } : T;

export type FinanceOverview = Jsonify<Awaited<ReturnType<typeof financeOverview>>>;
export type TeacherStatement = Jsonify<NonNullable<Awaited<ReturnType<typeof teacherStatement>>>>;
export type PayoutRun = Jsonify<Awaited<ReturnType<typeof getPayoutRun>>>;
export type PayoutView = PayoutRun["payouts"][number];
export type TransferView = PayoutRun["transfers"][number];
export type MoneyAccountView = Jsonify<Awaited<ReturnType<typeof listMoneyAccounts>>>["accounts"][number];
export type JournalEntryView = Jsonify<Awaited<ReturnType<typeof getEntry>>>;
export type CloseChecklist = Jsonify<Awaited<ReturnType<typeof getCloseChecklist>>>;
export type LockState = Jsonify<Awaited<ReturnType<typeof getLockState>>>;
export type OpeningPreviewView = Omit<OpeningPreview, "lines">;
export type OpeningState = {
  opened: boolean;
  openedAt: string | null;
  conversionDate: string | null;
  lockDate: string | null;
  canReopen: boolean;
  params: OpeningParams | null;
  suggestedDate: string | null;
};
export type LedgerAccountView = {
  id: number;
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  systemKey: string | null;
  parentId: number | null;
  archivedAt: string | null;
};

export type LedgerReportArgs = {
  name: ReportName;
  from?: string;
  to?: string;
  asOf?: string;
  locationId?: number;
  accountId?: number;
};

const qs = (params: Record<string, unknown>) =>
  new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "" && v !== null)
      .map(([k, v]) => [k, String(v)]),
  ).toString();

const T = ["Finance"] as const;

const ledgerApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getLedgerReport: builder.query<unknown, LedgerReportArgs>({
      query: ({ name, ...params }) => `/finance/reports/${name}?${qs(params)}`,
      providesTags: [...T],
    }),
    getFinanceOverview: builder.query<FinanceOverview, { from?: string; to?: string }>({
      query: (p) => `/finance/overview?${qs(p)}`,
      providesTags: [...T],
    }),
    getTeacherStatement: builder.query<TeacherStatement, { teacherId: number; from?: string; to?: string }>({
      query: ({ teacherId, ...p }) => `/finance/statements/teachers/${teacherId}?${qs(p)}`,
      providesTags: [...T],
    }),
    getLedgerAccounts: builder.query<{ accounts: LedgerAccountView[] }, void>({
      query: () => `/finance/ledger/accounts`,
      providesTags: [...T],
    }),
    getMoneyAccounts: builder.query<{ today: string; accounts: MoneyAccountView[] }, void>({
      query: () => `/finance/money-accounts`,
      providesTags: [...T],
    }),
    createMoneyAccount: builder.mutation<unknown, { holderUserId: number; locationId: number; name?: string; kind?: "CASH" | "BANK" | "EWALLET" }>({
      query: (body) => ({ url: `/finance/money-accounts`, method: "POST", body }),
      invalidatesTags: [...T],
    }),
    getPayoutRuns: builder.query<{ runs: PayoutRun[] }, void>({
      query: () => `/finance/payouts`,
      providesTags: [...T],
    }),
    createPayoutRun: builder.mutation<PayoutRun & { warnings: string[] }, { asOf?: string }>({
      query: (body) => ({ url: `/finance/payouts`, method: "POST", body }),
      invalidatesTags: [...T],
    }),
    updatePayout: builder.mutation<unknown, { id: number; fromMoneyAccountId?: number; paidAmount?: number }>({
      query: ({ id, ...body }) => ({ url: `/finance/payouts/${id}`, method: "PATCH", body }),
      invalidatesTags: [...T],
    }),
    markPayoutPaid: builder.mutation<unknown, { id: number; date?: string; fromMoneyAccountId?: number }>({
      query: ({ id, ...body }) => ({ url: `/finance/payouts/${id}/paid`, method: "POST", body }),
      invalidatesTags: [...T],
    }),
    deletePayout: builder.mutation<unknown, number>({
      query: (id) => ({ url: `/finance/payouts/${id}`, method: "DELETE" }),
      invalidatesTags: [...T],
    }),
    createMoneyTransfer: builder.mutation<unknown, { fromMoneyAccountId: number; toMoneyAccountId: number; amount: number; date?: string; pending?: boolean; note?: string }>({
      query: (body) => ({ url: `/finance/money-transfers`, method: "POST", body }),
      invalidatesTags: [...T],
    }),
    markTransferDone: builder.mutation<unknown, { id: number; date?: string }>({
      query: ({ id, ...body }) => ({ url: `/finance/money-transfers/${id}/done`, method: "POST", body }),
      invalidatesTags: [...T],
    }),
    deleteMoneyTransfer: builder.mutation<unknown, number>({
      query: (id) => ({ url: `/finance/money-transfers/${id}`, method: "DELETE" }),
      invalidatesTags: [...T],
    }),
    createOwnerTxn: builder.mutation<unknown, { kind: "CONTRIBUTION" | "DRAWING" | "DIVIDEND"; userId: number; amount: number; date?: string; moneyAccountId?: number; locationId?: number; note?: string }>({
      query: (body) => ({ url: `/finance/owner-transactions`, method: "POST", body }),
      invalidatesTags: [...T],
    }),
    createCashCount: builder.mutation<{ difference: number }, { moneyAccountId: number; counted: number; date?: string; note?: string }>({
      query: (body) => ({ url: `/finance/cash-counts`, method: "POST", body }),
      invalidatesTags: [...T],
    }),
    getJournal: builder.query<{ entries: JournalEntryView[] }, void>({
      query: () => `/finance/journal`,
      providesTags: [...T],
    }),
    createJournalEntry: builder.mutation<JournalEntryView, { date: string; memo: string; lines: { accountId: number; locationId: number; amount: number }[] }>({
      query: (body) => ({ url: `/finance/journal`, method: "POST", body }),
      invalidatesTags: [...T],
    }),
    reverseJournalEntry: builder.mutation<JournalEntryView, { id: number; date?: string }>({
      query: ({ id, ...body }) => ({ url: `/finance/journal/${id}/reverse`, method: "POST", body }),
      invalidatesTags: [...T],
    }),
    getLockState: builder.query<LockState, void>({
      query: () => `/finance/lock`,
      providesTags: [...T],
    }),
    setLockDate: builder.mutation<LockState, { lockDate: string | null; note?: string }>({
      query: (body) => ({ url: `/finance/lock`, method: "POST", body }),
      invalidatesTags: [...T],
    }),
    getCloseChecklist: builder.query<CloseChecklist, { asOf?: string }>({
      query: (p) => `/finance/close?${qs(p)}`,
      providesTags: [...T],
    }),
    signOffBranch: builder.mutation<unknown, { locationId: number; asOf: string }>({
      query: (body) => ({ url: `/finance/close/signoff`, method: "POST", body }),
      invalidatesTags: [...T],
    }),
    getOpening: builder.query<OpeningState, void>({
      query: () => `/finance/opening`,
      providesTags: [...T],
    }),
    previewOpening: builder.mutation<OpeningPreviewView, OpeningParams>({
      query: (body) => ({ url: `/finance/opening/preview`, method: "POST", body }),
    }),
    openLedger: builder.mutation<unknown, OpeningParams>({
      query: (body) => ({ url: `/finance/opening`, method: "POST", body }),
      invalidatesTags: [...T],
    }),
  }),
});

export const {
  useGetLedgerReportQuery,
  useGetFinanceOverviewQuery,
  useGetTeacherStatementQuery,
  useGetLedgerAccountsQuery,
  useGetMoneyAccountsQuery,
  useCreateMoneyAccountMutation,
  useGetPayoutRunsQuery,
  useCreatePayoutRunMutation,
  useUpdatePayoutMutation,
  useMarkPayoutPaidMutation,
  useDeletePayoutMutation,
  useCreateMoneyTransferMutation,
  useMarkTransferDoneMutation,
  useDeleteMoneyTransferMutation,
  useCreateOwnerTxnMutation,
  useCreateCashCountMutation,
  useGetJournalQuery,
  useCreateJournalEntryMutation,
  useReverseJournalEntryMutation,
  useGetLockStateQuery,
  useSetLockDateMutation,
  useGetCloseChecklistQuery,
  useSignOffBranchMutation,
  useGetOpeningQuery,
  usePreviewOpeningMutation,
  useOpenLedgerMutation,
} = ledgerApi;
