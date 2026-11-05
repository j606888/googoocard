import { useGetFinanceSettingsQuery } from "@/store/slices/finance";
import { useGetMeQuery } from "@/store/slices/me";
import { useFinanceEnabled } from "@/features/nav/useFinanceEnabled";

/** 現在這個人的財務身分（財務沒開 → 都是 false，不打財務 API）。 */
export function useFinanceRole(): { canSettle: boolean; isCustodian: boolean; meId: number | null } {
  const enabled = useFinanceEnabled();
  const { data: settings } = useGetFinanceSettingsQuery(undefined, { skip: !enabled });
  const { data: me } = useGetMeQuery(undefined, { skip: !enabled });
  const mine = enabled && me ? settings?.members.find((m) => m.userId === me.id) : undefined;
  return { canSettle: !!mine?.canSettle, isCustodian: !!mine?.isCustodian, meId: me?.id ?? null };
}

/** 現在這個人能不能結算／改財務（Membership.canSettle；財務沒開 → false，不打財務 API）。 */
export function useCanSettle(): boolean {
  return useFinanceRole().canSettle;
}
