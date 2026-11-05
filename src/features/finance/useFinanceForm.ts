import { useGetFinanceSettingsQuery } from "@/store/slices/finance";
import { useGetMeQuery } from "@/store/slices/me";

/** 表單共用：可以選的收款／付款人（保管人），預設是自己。 */
export function useFinanceMembers() {
  const { data: settings } = useGetFinanceSettingsQuery();
  const { data: me } = useGetMeQuery();
  const allMembers = settings?.members ?? [];
  const members = allMembers.filter((m) => m.isCustodian);
  const defaultUserId = members.find((m) => m.userId === me?.id)?.userId ?? members[0]?.userId ?? 0;
  return {
    options: members.map((m) => ({ value: m.userId, label: m.name })),
    defaultUserId,
    allMembers,
    meId: me?.id ?? null,
  };
}
