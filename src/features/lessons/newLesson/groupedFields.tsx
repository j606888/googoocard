import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import CardFormDrawer from "@/features/cards/CardForm/CardFormDrawer";
import TeacherForm from "@/features/teachers/TeacherForm";
import TeacherAvatar from "@/features/teachers/TeacherAvatar";
import { cardMatchesLesson } from "@/domains/qualification";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { assistantsFirst, canTeach } from "@/lib/teachers";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import { useLocations } from "@/hooks/useLocations";
import { useGetCardsQuery } from "@/store/slices/cards";
import { useGetLessonGroupsQuery, type LessonGroup } from "@/store/slices/lessonGroups";
import { useGetTeachersQuery } from "@/store/slices/teachers";
import { ActionRow, CheckRow, GROUP_CARD, GroupedRow, GroupedSection, InlineInput, SegmentedControl, TRACK_BG } from "./grouped";
import type { SeriesChoice } from "./SeriesPicker";

/**
 * 新增課程各欄位的「分組清單」版本（Apple 風）。資料規則跟課程設定用的那幾個 Select 一樣，
 * 只是畫成整列打勾。課程設定抽屜仍用原本的元件。
 */

export type SeriesMode = "existing" | "new";

const WEEKDAY_LABELS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
/** 星期一排第一、週日最後；沒排時段的放最後面。 */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const NO_SLOT = 7;
const ALL = "__all__";
const NO_LOCATION = "__none__";

const startOf = (group: LessonGroup) =>
  group.latestTerm?.firstStart ? new Date(group.latestTerm.firstStart) : null;

/**
 * 課種列的說明（最近一期的）：「台南 · 週日 14:00 · Sean · 開過 5 期 · 上一期 10/3 開始」。
 * 清單已經照星期分段、或只看某個分部時，就省掉重複的那一段。
 */
const describeGroup = (group: LessonGroup, { weekday = true, location = true } = {}) => {
  const term = group.latestTerm;
  const start = startOf(group);
  return [
    location ? term?.locationName : null,
    start ? `${weekday ? `${WEEKDAY_LABELS[start.getDay()]} ` : ""}${format(start, "HH:mm")}` : null,
    term?.teacherNames.length ? term.teacherNames.join("、") : null,
    group.lessonCount > 0 ? `開過 ${group.lessonCount} 期` : "還沒開過",
    start ? `上一期 ${format(start, "M/d")} 開始` : null,
  ]
    .filter(Boolean)
    .join(" · ");
};

/** 最近開過的排上面；有期但還沒排時段的算最新，沒開過的放最後。 */
const recency = (group: LessonGroup) =>
  group.latestTerm?.firstStart
    ? new Date(group.latestTerm.firstStart).getTime()
    : group.latestTerm
      ? Infinity
      : -Infinity;

/** 同一天裡照上課時間，再照最近開過的。 */
const minuteOfDay = (group: LessonGroup) => {
  const start = startOf(group);
  return start ? start.getHours() * 60 + start.getMinutes() : Infinity;
};

const SEARCH_FROM = 8;

/**
 * 課種：先選「延續現有課種」或「全新課種」。
 * 延續：第一層分部（分段控制）、第二層照最近一期是星期幾分段，一眼找到「週日台南的 Bachata Lv2」；
 * 挑完收成一列＋「換一個」。全新就打名字。下面接「這一期另取名稱」。
 */
export const SeriesGroup = ({
  mode,
  onModeChange,
  value,
  onChange,
  customName,
  onCustomNameChange,
  showCustomName,
  onShowCustomNameChange,
  baseName,
  error,
}: {
  mode: SeriesMode;
  onModeChange: (mode: SeriesMode) => void;
  value: SeriesChoice;
  onChange: (choice: SeriesChoice) => void;
  customName: string;
  onCustomNameChange: (name: string) => void;
  showCustomName: boolean;
  onShowCustomNameChange: (show: boolean) => void;
  baseName: string;
  error?: string;
}) => {
  const { data: groups = [] } = useGetLessonGroupsQuery();
  const [browsing, setBrowsing] = useState(false);
  const [query, setQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>(ALL);
  const picked = value?.type === "existing" ? groups.find((g) => g.id === value.id) : undefined;
  const listOpen = mode === "existing" && (!picked || browsing);

  const locationKey = (g: LessonGroup) => g.latestTerm?.locationName ?? NO_LOCATION;
  // 照教室設定的分部順序排，按鈕位置才不會每次跳。
  const { all: allLocations } = useLocations();
  const locationRank = (name: string) => {
    const index = allLocations.findIndex((l) => l.name === name);
    return index === -1 ? Infinity : index;
  };
  const locationNames = [
    ...new Set(groups.map((g) => g.latestTerm?.locationName).filter((n): n is string => !!n)),
  ].sort((a, b) => locationRank(a) - locationRank(b) || a.localeCompare(b));
  const hasUnlocated = groups.some((g) => !g.latestTerm?.locationName);
  const showLocationFilter = locationNames.length >= 2 || (locationNames.length === 1 && hasUnlocated);

  const needle = query.trim().toLowerCase();
  const shown = groups.filter(
    (g) =>
      (locationFilter === ALL || locationKey(g) === locationFilter) &&
      (!needle || g.name.toLowerCase().includes(needle))
  );
  const sections = [...WEEKDAY_ORDER, NO_SLOT]
    .map((day) => ({
      day,
      groups: shown
        .filter((g) => (startOf(g)?.getDay() ?? NO_SLOT) === day)
        .sort((a, b) => minuteOfDay(a) - minuteOfDay(b) || recency(b) - recency(a) || a.name.localeCompare(b.name)),
    }))
    .filter((section) => section.groups.length > 0);

  const pick = (id: number) => {
    setBrowsing(false);
    setQuery("");
    onChange({ type: "existing", id });
  };

  const footer = picked
    ? `這是「${picked.name}」的第 ${picked.lessonCount + 1} 期。`
    : mode === "new"
      ? "課名預設就是課種名稱；要不一樣再另取。"
      : "先選分部，再照星期找；上一期的設定會整套帶進來。";

  return (
    <GroupedSection title="課程" error={error} footer={footer} bare>
      {groups.length > 0 && (
        <SegmentedControl<SeriesMode>
          ariaLabel="延續或全新"
          className="[&>button]:h-9"
          value={mode}
          onChange={(next) => {
            setBrowsing(false);
            setQuery("");
            onModeChange(next);
          }}
          options={[
            { value: "existing", label: "延續現有課種" },
            { value: "new", label: "全新課種" },
          ]}
        />
      )}

      {listOpen ? (
        <div className="mt-1 flex flex-col gap-4">
          {(showLocationFilter || groups.length > SEARCH_FROM) && (
            <div className="flex flex-col gap-2">
              {showLocationFilter && (
                <SegmentedControl<string>
                  ariaLabel="分部"
                  className="[&>button]:h-9"
                  value={locationFilter}
                  onChange={setLocationFilter}
                  options={[
                    { value: ALL, label: "全部" },
                    ...locationNames.map((name) => ({ value: name, label: name })),
                    ...(hasUnlocated ? [{ value: NO_LOCATION, label: "沒設分部" }] : []),
                  ]}
                />
              )}
              {groups.length > SEARCH_FROM && (
                <label className="flex h-10 items-center gap-2 rounded-[9px] bg-white px-3">
                  <Search aria-hidden="true" className="size-4 shrink-0 text-neutral-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜尋課種"
                    aria-label="搜尋課種"
                    className="min-w-0 flex-1 bg-transparent text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400"
                  />
                </label>
              )}
            </div>
          )}
          {sections.map(({ day, groups: dayGroups }) => (
            <div key={day} className="flex flex-col gap-1.5">
              <h4 className="px-4 text-[13px] font-semibold text-neutral-500">
                {day === NO_SLOT ? "還沒排時段" : WEEKDAY_LABELS[day]}
              </h4>
              <div className={cn(GROUP_CARD, error && "ring-1 ring-danger-500")}>
                {dayGroups.map((group) => (
                  <CheckRow
                    key={group.id}
                    checked={group.id === picked?.id}
                    hint={describeGroup(group, { weekday: false, location: locationFilter === ALL })}
                    onToggle={() => pick(group.id)}
                  >
                    {group.name}
                  </CheckRow>
                ))}
              </div>
            </div>
          ))}
          {groups.length > 0 && sections.length === 0 && (
            <p className="px-4 text-[15px] text-neutral-500">
              {needle ? `找不到「${query.trim()}」。` : "這個分部還沒有課種。"}
            </p>
          )}
        </div>
      ) : (
        <div className={cn(GROUP_CARD, error && "ring-1 ring-danger-500")}>
          {mode === "new" && (
            <InlineInput
              label="課種名稱"
              placeholder="例如 Bachata Lv1"
              maxLength={60}
              value={value?.type === "new" ? value.name : ""}
              onChange={(name) => onChange({ type: "new", name })}
            />
          )}
          {mode === "existing" && picked && (
            <div className="flex min-h-14 items-center gap-3 px-4 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold text-neutral-900">{picked.name}</span>
                <span className="text-[13px] text-neutral-500">{describeGroup(picked)}</span>
              </span>
              <button
                type="button"
                onClick={() => setBrowsing(true)}
                className="shrink-0 cursor-pointer text-[15px] font-medium text-primary-700 hover:underline"
              >
                換一個
              </button>
            </div>
          )}
          {value && (
            <GroupedRow label="這一期另取名稱">
              <ToggleSwitch
                checked={showCustomName}
                onChange={(on) => {
                  if (on && !customName.trim()) onCustomNameChange(baseName);
                  onShowCustomNameChange(on);
                }}
                label="這一期另取名稱"
              />
            </GroupedRow>
          )}
          {value && showCustomName && (
            <InlineInput label="名稱" placeholder={baseName} value={customName} onChange={onCustomNameChange} />
          )}
        </div>
      )}
    </GroupedSection>
  );
};

/** iOS 風格開關（不另外引入 Radix，避免和群組列的按鈕搶點擊）。 */
export const ToggleSwitch = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative h-[31px] w-[51px] shrink-0 cursor-pointer rounded-full transition-colors ${
      checked ? "bg-primary-600" : TRACK_BG
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15)] transition-transform ${
        checked ? "translate-x-5" : ""
      }`}
    />
  </button>
);

/** 舞種：四個以內畫成分段控制（帶色點），再多就整列打勾。`children` 是接在下面的列（階級）。 */
export const DanceStyleGroup = ({
  danceStyleId,
  onChange,
  error,
  footer,
  children,
}: {
  danceStyleId: number | null;
  onChange: (id: number) => void;
  error?: string;
  footer?: string;
  children?: React.ReactNode;
}) => {
  const { styles } = useDanceStyles();
  const dot = (style: (typeof styles)[number]) => (
    <span className={`size-2 shrink-0 rounded-full ${danceStyleMeta(style).dot}`} />
  );
  if (styles.length > 0 && styles.length <= 4 && danceStyleId !== null) {
    return (
      <GroupedSection title="舞種" error={error} footer={footer} bare>
        <SegmentedControl
          ariaLabel="舞種"
          className="[&>button]:h-9"
          value={danceStyleId}
          onChange={onChange}
          options={styles.map((style) => ({ value: style.id, label: style.name, leading: dot(style) }))}
        />
        {children && <div className={GROUP_CARD}>{children}</div>}
      </GroupedSection>
    );
  }
  return (
    <GroupedSection title="舞種" error={error} footer={footer}>
      {styles.map((style) => (
        <CheckRow
          key={style.id}
          checked={style.id === danceStyleId}
          onToggle={() => onChange(style.id)}
          leading={dot(style)}
        >
          {style.name}
        </CheckRow>
      ))}
      {children}
    </GroupedSection>
  );
};

export const CardGroup = ({
  selectedCardIds,
  onChange,
  danceStyleId,
  error,
}: {
  selectedCardIds: number[];
  onChange: (ids: number[]) => void;
  danceStyleId: number | null;
  error?: string;
}) => {
  const { data: cards } = useGetCardsQuery();
  const [creating, setCreating] = useState(false);
  // 跟 CardSelect 一樣：在售的卡＋學生手上還有的停用卡＋已選的；別的舞種的複習卡不列。
  const candidates = [
    ...(cards?.activeCards ?? []),
    ...(cards?.expiredCards ?? []).filter(
      (card) => card.activeHolders > 0 || selectedCardIds.includes(card.id)
    ),
  ].filter((card) => cardMatchesLesson(card, danceStyleId));

  useEffect(() => {
    if (!cards || danceStyleId === null) return;
    const all = [...cards.activeCards, ...cards.expiredCards];
    const valid = selectedCardIds.filter((id) => {
      const card = all.find((c) => c.id === id);
      return !card || cardMatchesLesson(card, danceStyleId);
    });
    if (valid.length !== selectedCardIds.length) {
      toast.info("已移除與舞種不符的複習卡");
      onChange(valid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [danceStyleId, cards, selectedCardIds]);

  const toggle = (id: number) =>
    onChange(selectedCardIds.includes(id) ? selectedCardIds.filter((x) => x !== id) : [...selectedCardIds, id]);

  return (
    <GroupedSection title="收哪些課卡" error={error} footer="可以複選。開放單堂付費的課可以不收課卡。">
      {candidates.map((card) => (
        <CheckRow
          key={card.id}
          checked={selectedCardIds.includes(card.id)}
          onToggle={() => toggle(card.id)}
          hint={card.expiredAt ? "已停用" : undefined}
        >
          {card.name}
        </CheckRow>
      ))}
      <ActionRow onClick={() => setCreating(true)}>＋ 新增課卡</ActionRow>
      {creating && (
        <CardFormDrawer
          target={{ mode: "new", danceStyleId }}
          onClose={() => setCreating(false)}
          onSaved={(cardId) => onChange([...selectedCardIds, cardId])}
        />
      )}
    </GroupedSection>
  );
};

export const LocationGroup = ({
  locationId,
  onChange,
  required = false,
  error,
}: {
  locationId: number | null;
  onChange: (id: number | null) => void;
  /** 財務開啟的教室每門課都要有分部：不給「不指定」。 */
  required?: boolean;
  error?: string;
}) => {
  const { all, locations } = useLocations();
  const current = all.find((l) => l.id === locationId);
  const options = current?.archivedAt ? [...locations, current] : locations;
  if (options.length === 0) return null;
  return (
    <GroupedSection title="分部" error={error} footer={required ? "開了財務，每門課都要選分部。" : undefined}>
      {options.map((location) => (
        <CheckRow
          key={location.id}
          checked={location.id === locationId}
          onToggle={() => onChange(location.id)}
        >
          {location.name}
        </CheckRow>
      ))}
      {!required && (
        <CheckRow checked={locationId === null} onToggle={() => onChange(null)}>
          <span className="text-neutral-500">不指定</span>
        </CheckRow>
      )}
    </GroupedSection>
  );
};

export const TeacherGroup = ({
  selectedTeacherIds,
  onChange,
  error,
}: {
  selectedTeacherIds: number[];
  onChange: (ids: number[]) => void;
  error?: string;
}) => {
  const { data: teachers = [] } = useGetTeachersQuery();
  const [formKey, setFormKey] = useState<number | null>(null);
  const options = teachers.filter(
    (t) => (!t.archivedAt && canTeach(t.kind)) || selectedTeacherIds.includes(t.id)
  );
  const toggle = (id: number) =>
    onChange(selectedTeacherIds.includes(id) ? selectedTeacherIds.filter((x) => x !== id) : [...selectedTeacherIds, id]);
  return (
    <GroupedSection title="老師" error={error} footer="可以複選。">
      {options.map((teacher) => (
        <CheckRow
          key={teacher.id}
          checked={selectedTeacherIds.includes(teacher.id)}
          onToggle={() => toggle(teacher.id)}
          leading={<TeacherAvatar name={teacher.name} color={teacher.color} icon={teacher.icon} size="sm" />}
        >
          {teacher.name}
        </CheckRow>
      ))}
      <ActionRow onClick={() => setFormKey(Date.now())}>＋ 新增老師</ActionRow>
      {formKey !== null && (
        <TeacherForm
          key={formKey}
          open
          onClose={() => setFormKey(null)}
          onCreated={(teacher) => onChange([...selectedTeacherIds, teacher.id])}
        />
      )}
    </GroupedSection>
  );
};

export const AssistantGroup = ({
  selectedAssistantIds,
  teacherIds,
  onChange,
}: {
  selectedAssistantIds: number[];
  teacherIds: number[];
  onChange: (ids: number[]) => void;
}) => {
  const { data: teachers = [] } = useGetTeachersQuery();
  const options = assistantsFirst(teachers).filter(
    (t) => !teacherIds.includes(t.id) && (!t.archivedAt || selectedAssistantIds.includes(t.id))
  );
  if (options.length === 0) return null;
  const toggle = (id: number) =>
    onChange(
      selectedAssistantIds.includes(id) ? selectedAssistantIds.filter((x) => x !== id) : [...selectedAssistantIds, id]
    );
  return (
    <GroupedSection title="小幫手（選填）">
      {options.map((teacher) => (
        <CheckRow
          key={teacher.id}
          checked={selectedAssistantIds.includes(teacher.id)}
          onToggle={() => toggle(teacher.id)}
          leading={<TeacherAvatar name={teacher.name} color={teacher.color} icon={teacher.icon} size="sm" />}
        >
          {teacher.name}
        </CheckRow>
      ))}
    </GroupedSection>
  );
};
