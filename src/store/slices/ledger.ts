import { api } from "../api";
import type { ReportName } from "@/service/ledger/reports";

// 財務 v2 總帳（docs/finance-v2/）。報表金額單位「分」。
export type LedgerReportArgs = {
  name: ReportName;
  from?: string;
  to?: string;
  asOf?: string;
  locationId?: number;
  accountId?: number;
};

const ledgerApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getLedgerReport: builder.query<unknown, LedgerReportArgs>({
      query: ({ name, ...params }) => {
        const qs = new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined && v !== "")
            .map(([k, v]) => [k, String(v)]),
        );
        return `/finance/reports/${name}?${qs}`;
      },
      providesTags: ["Finance"],
    }),
  }),
});

export const { useGetLedgerReportQuery } = ledgerApi;
