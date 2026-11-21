import { useGetTeachersQuery } from "@/store/slices/teachers";
import { useGetLocationsQuery } from "@/store/slices/locations";
import { useGetFinancePacksQuery, useGetFinanceSettingsQuery, useGetFinanceVenuesQuery } from "@/store/slices/finance";
import type { Payee } from "@/domains/finance/types";
import type { Namer } from "./ruleEditorModel";
import { venueUnit as unitOfVenue } from "./venueBilling";

export type SplitNames = ReturnType<typeof useSplitNames>;

/** 分帳畫面要的名字（老師、分部、場地、成員）和「現在這個人能不能編輯」。名字都是資料，不寫死。 */
export function useSplitNames() {
  const { data: teachers = [] } = useGetTeachersQuery();
  const { data: locationData } = useGetLocationsQuery();
  const { data: venueData } = useGetFinanceVenuesQuery();
  const { data: packData } = useGetFinancePacksQuery();
  const { data: settings } = useGetFinanceSettingsQuery();

  const locations = locationData?.locations ?? [];
  const venues = venueData?.venues ?? [];
  const members = settings?.members ?? [];

  const teacher = (id: number) => teachers.find((t) => t.id === id)?.name ?? "（已刪除的老師）";
  const location = (id: number) => locations.find((l) => l.id === id)?.name ?? "（未知分部）";
  const member = (userId: number) => members.find((m) => m.userId === userId)?.name ?? "（已離開的成員）";
  /** 規則裡的說法：房東是成員 →「房東丁丁」，外部場地 → 場地名。 */
  const venue = (id: number) => {
    const v = venues.find((x) => x.id === id);
    if (!v) return "（未知場地）";
    const landlord = members.find((m) => m.userId === v.landlordUserId)?.name;
    return landlord ? `房東${landlord}` : v.name;
  };
  /** 下拉選單用：場地名＋房東，才分得出是哪個場地。 */
  const venueLabel = (id: number) => {
    const v = venues.find((x) => x.id === id);
    if (!v) return "（未知場地）";
    const landlord = members.find((m) => m.userId === v.landlordUserId)?.name;
    return landlord ? `${v.name}（${landlord}）` : v.name;
  };
  /** 「場地費」一堂多少：每次付的價，或目前這包的單價；不知道 → null。 */
  const venueUnit = (id: number) => unitOfVenue(venues.find((v) => v.id === id), packData?.packs ?? []);
  /** lessonLocationId 給了的話，「這堂課的分部公積金」會寫出分部名。 */
  const payee = (p: Payee, lessonLocationId?: number | null) => {
    switch (p.type) {
      case "teacher":
        return teacher(p.teacherId);
      case "fund":
        return `${location(p.locationId)}公積金`;
      case "venue":
        return venue(p.venueId);
      case "lessonFund":
        return lessonLocationId ? `${location(lessonLocationId)}公積金（這堂課的分部）` : "這堂課的分部公積金";
      case "holder":
        return "卡錢的分部";
    }
  };
  const namer = (lessonLocationId?: number | null): Namer => ({
    payee: (p) => payee(p, lessonLocationId),
    venue,
    teacher,
    location,
  });

  return {
    teachers: teachers.filter((t) => !t.archivedAt),
    locations: locations.filter((l) => !l.archivedAt),
    venues: venues.filter((v) => !v.archivedAt),
    members,
    teacher,
    location,
    member,
    venue,
    venueLabel,
    venueUnit,
    payee,
    namer,
    canEdit: !!settings?.canManage,
    ready: !!locationData && !!venueData && !!settings,
  };
}
