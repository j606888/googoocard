import { useGetTeachersQuery } from "@/store/slices/teachers";
import { useGetLocationsQuery } from "@/store/slices/locations";
import { useGetFinanceSettingsQuery, useGetFinanceVenuesQuery } from "@/store/slices/finance";
import { useGetMeQuery } from "@/store/slices/me";
import type { Payee } from "@/domains/finance/types";

export type SplitNames = ReturnType<typeof useSplitNames>;

/** 分帳畫面要的名字（老師、分部、場地）和「現在這個人能不能編輯」。名字都是資料，不寫死。 */
export function useSplitNames() {
  const { data: teachers = [] } = useGetTeachersQuery();
  const { data: locationData } = useGetLocationsQuery();
  const { data: venueData } = useGetFinanceVenuesQuery();
  const { data: settings } = useGetFinanceSettingsQuery();
  const { data: me } = useGetMeQuery();

  const locations = locationData?.locations ?? [];
  const venues = venueData?.venues ?? [];
  const members = settings?.members ?? [];

  const teacher = (id: number) => teachers.find((t) => t.id === id)?.name ?? "（已刪除的老師）";
  const location = (id: number) => locations.find((l) => l.id === id)?.name ?? "（未知分部）";
  const venue = (id: number) => {
    const v = venues.find((x) => x.id === id);
    if (!v) return "（未知場地）";
    const landlord = members.find((m) => m.userId === v.landlordUserId)?.name;
    return landlord ? `${v.name}（${landlord}）` : v.name;
  };
  const payee = (p: Payee) =>
    p.type === "teacher" ? teacher(p.teacherId) : p.type === "fund" ? `${location(p.locationId)}公積金` : venue(p.venueId);

  return {
    teachers: teachers.filter((t) => !t.archivedAt),
    locations: locations.filter((l) => !l.archivedAt),
    venues: venues.filter((v) => !v.archivedAt),
    teacher,
    location,
    venue,
    payee,
    canEdit: !!me && members.some((m) => m.userId === me.id && m.isFinance),
    ready: !!locationData && !!venueData,
  };
}
