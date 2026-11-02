import { api } from "../api";

export interface FinanceSettings {
  enabled: boolean;
  launchDate: string | null;
  roundTo: number;
  legacyCustodianUserId: number | null;
  members: { userId: number; name: string; isFinance: boolean }[];
}

const financeApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getFinanceSettings: builder.query<FinanceSettings, void>({
      query: () => "finance/settings",
      providesTags: ["Classroom", "Membership"],
    }),
  }),
});

export const { useGetFinanceSettingsQuery } = financeApi;
