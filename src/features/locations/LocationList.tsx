"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  MapPin,
  Pencil,
  Plus,
} from "lucide-react";
import ListSkeleton from "@/components/skeletons/ListSkeleton";
import { Switch } from "@/components/ui/switch";
import {
  useGetLocationsQuery,
  useReorderLocationsMutation,
  useUpdateLocationMutation,
  useUpdateLocationSettingsMutation,
  type Location,
} from "@/store/slices/locations";
import LocationForm from "./LocationForm";
import AssignLocationDrawer from "./AssignLocationDrawer";

type FormState = { open: false } | { open: true; location?: Location; key: number };

const iconButton =
  "w-9 h-9 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent";

/** /locations：分部（台南／高雄…）。Same shape as the dance-style page. */
const LocationList = () => {
  const { data, isLoading } = useGetLocationsQuery();
  const all = data?.locations ?? [];
  const [updateLocation] = useUpdateLocationMutation();
  const [reorderLocations, { isLoading: reordering }] = useReorderLocationsMutation();
  const [updateSettings, { isLoading: savingSettings }] = useUpdateLocationSettingsMutation();
  const [form, setForm] = useState<FormState>({ open: false });
  const [assigning, setAssigning] = useState<Location | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const active = all.filter((l) => !l.archivedAt);
  const archived = all.filter((l) => l.archivedAt);

  const openForm = (location?: Location) => setForm({ open: true, location, key: Date.now() });

  const move = async (index: number, delta: -1 | 1) => {
    const next = [...active];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    try {
      await reorderLocations([...next, ...archived].map((l) => l.id)).unwrap();
    } catch {
      toast.error("排序失敗，請重新整理後再試");
    }
  };

  const setArchived = async (location: Location, value: boolean) => {
    try {
      await updateLocation({ id: location.id, archived: value }).unwrap();
      toast.success(value ? `已封存 ${location.name}` : `已還原 ${location.name}`);
    } catch {
      toast.error("操作失敗，請稍後再試");
    }
  };

  const setLineListed = async (lineListed: boolean) => {
    try {
      await updateSettings({ lineListed }).unwrap();
    } catch {
      toast.error("儲存失敗，請稍後再試");
    }
  };

  if (isLoading) return <ListSkeleton />;

  return (
    <>
      <div className="w-full px-5 py-3 lg:max-w-[720px] lg:px-8 lg:py-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">分部</h2>
          <button
            type="button"
            onClick={() => openForm()}
            className="flex items-center gap-2 rounded-full bg-primary-500 px-4 py-1.5 text-white cursor-pointer hover:bg-primary-600"
          >
            <Plus className="h-4 w-4" />
            <span className="font-medium">新增分部</span>
          </button>
        </div>
        <p className="mb-4 text-sm text-neutral-500">
          同一間教室的不同上課地點。開課時可以選分部，課表和 LINE 會依分部顯示；課卡各分部通用。
        </p>

        <label className="mb-5 flex items-start gap-3 rounded-xl bg-neutral-50 p-3 cursor-pointer">
          <Switch
            checked={data?.lineListed ?? false}
            disabled={savingSettings}
            onCheckedChange={setLineListed}
            className="mt-0.5"
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">在 LINE 官方帳號公開課表與價目表</span>
            <span className="text-xs leading-relaxed text-neutral-500">
              開啟後，還沒綁定的人在 LINE 點「課表」「價目表」也看得到這間教室的課。已綁定的學生不受影響。
            </span>
          </span>
        </label>

        {active.length === 0 && (
          <div className="mb-4 flex flex-col items-center justify-center gap-3 rounded-sm bg-primary-50 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-500">
              <MapPin className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-lg font-bold">還沒有分部</p>
              <p className="text-center text-sm text-neutral-500">只有一個上課地點的話可以不用設定。</p>
            </div>
          </div>
        )}

        <ul className="flex flex-col">
          {active.map((location, index) => (
            <li key={location.id} className="flex items-center gap-2 border-b border-neutral-200 py-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-neutral-500" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{location.name}</span>
                {location.address && (
                  <span className="truncate text-xs text-neutral-500">{location.address}</span>
                )}
              </span>
              <div className="ml-auto flex shrink-0 items-center">
                <button
                  type="button"
                  aria-label={`把 ${location.name} 套用到既有課程`}
                  title="套用到既有課程"
                  className={iconButton}
                  onClick={() => setAssigning(location)}
                >
                  <CalendarCheck className="h-4.5 w-4.5" />
                </button>
                <button
                  type="button"
                  aria-label={`${location.name} 上移`}
                  className={iconButton}
                  disabled={index === 0 || reordering}
                  onClick={() => move(index, -1)}
                >
                  <ChevronUp className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label={`${location.name} 下移`}
                  className={iconButton}
                  disabled={index === active.length - 1 || reordering}
                  onClick={() => move(index, 1)}
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label={`編輯 ${location.name}`}
                  className={iconButton}
                  onClick={() => openForm(location)}
                >
                  <Pencil className="h-4.5 w-4.5" />
                </button>
                <button
                  type="button"
                  aria-label={`封存 ${location.name}`}
                  title="封存"
                  className={iconButton}
                  onClick={() => setArchived(location, true)}
                >
                  <Archive className="h-4.5 w-4.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        {archived.length > 0 && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="flex items-center gap-1 text-sm font-medium text-neutral-500 cursor-pointer"
              aria-expanded={showArchived}
            >
              {showArchived ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              已封存（{archived.length}）
            </button>
            {showArchived && (
              <ul className="mt-2 flex flex-col">
                {archived.map((location) => (
                  <li
                    key={location.id}
                    className="flex items-center gap-2 border-b border-neutral-200 py-2.5 text-neutral-500"
                  >
                    <MapPin className="h-4 w-4 shrink-0 opacity-50" />
                    <span className="truncate">{location.name}</span>
                    <button
                      type="button"
                      onClick={() => setArchived(location, false)}
                      className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-primary-700 hover:bg-primary-50 cursor-pointer"
                    >
                      <ArchiveRestore className="h-4 w-4" />
                      還原
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {form.open && (
        <LocationForm
          key={form.key}
          open
          location={form.location}
          all={all}
          onClose={() => setForm({ open: false })}
        />
      )}
      {assigning && <AssignLocationDrawer location={assigning} onClose={() => setAssigning(null)} />}
    </>
  );
};

export default LocationList;
