import { useGetFinanceSettingsQuery } from "@/store/slices/finance";
import { useGetMeQuery } from "@/store/slices/me";
import { useFinanceEnabled } from "@/features/nav/useFinanceEnabled";

/** 現在這個人是不是這間教室的財務（財務沒開 → false，不打財務 API）。 */
export function useIsFinance(): boolean {
  const enabled = useFinanceEnabled();
  const { data: settings } = useGetFinanceSettingsQuery(undefined, { skip: !enabled });
  const { data: me } = useGetMeQuery(undefined, { skip: !enabled });
  return enabled && !!me && !!settings?.members.some((m) => m.userId === me.id && m.isFinance);
}
