import { useEffect, useState } from "react";
import { toast } from "sonner";
import Select from "@/components/Select";
import CardFormDrawer from "@/features/cards/CardForm/CardFormDrawer";
import TeacherForm from "@/features/teachers/TeacherForm";
import TeacherAvatar from "@/features/teachers/TeacherAvatar";
import { cardMatchesLesson } from "@/domains/qualification";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { assistantsFirst, canTeach } from "@/lib/teachers";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import { useLocations } from "@/hooks/useLocations";
import { useGetCardsQuery } from "@/store/slices/cards";
import { useGetLessonGroupsQuery } from "@/store/slices/lessonGroups";
import { useGetTeachersQuery } from "@/store/slices/teachers";
import { ActionRow, CheckRow, GROUP_CARD, GroupedRow, GroupedSection, InlineInput, SegmentedControl, TRACK_BG } from "./grouped";
import type { SeriesChoice } from "./SeriesPicker";

/**
 * 新增課程各欄位的「分組清單」版本（Apple 風）。資料規則跟課程設定用的那幾個 Select 一樣，
 * 只是畫成整列打勾。課程設定抽屜仍用原本的元件。
 */

const NEW = -1;

/** 課種＋這一期的名稱。 */
export const SeriesGroup = ({
  value,
  onChange,
  customName,
  onCustomNameChange,
  showCustomName,
  onShowCustomNameChange,
  baseName,
  error,
}: {
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
  const picked = value?.type === "existing" ? groups.find((g) => g.id === value.id) : undefined;
  return (
    <GroupedSection
      title="課程"
      error={error}
      footer={
        picked
          ? `這是「${picked.name}」的第 ${picked.lessonCount + 1} 期。`
          : "課名預設就是課種名稱；要不一樣再另取。"
      }
    >
      <GroupedRow label="課種">
        <Select<number>
          aria-label="課種"
          value={value?.type === "existing" ? value.id : value?.type === "new" ? NEW : undefined}
          placeholder="選一個"
          onChange={(next) => onChange(next === NEW ? { type: "new", name: "" } : { type: "existing", id: next })}
          options={[
            ...groups.map((g) => ({
              value: g.id,
              label: g.name,
              hint: g.lessonCount > 0 ? `開過 ${g.lessonCount} 期` : undefined,
            })),
            { value: NEW, label: "＋ 新課種" },
          ]}
          className="h-10 w-auto max-w-full justify-end border-0 bg-transparent px-0 text-[15px] text-neutral-500 shadow-none ring-0 focus:ring-0 focus-within:ring-0"
        />
      </GroupedRow>
      {value?.type === "new" && (
        <InlineInput
          label="新課種名稱"
          placeholder="例如 Bachata Lv1"
          maxLength={60}
          value={value.name}
          onChange={(name) => onChange({ type: "new", name })}
        />
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
        <InlineInput
          label="名稱"
          placeholder={baseName}
          value={customName}
          onChange={onCustomNameChange}
        />
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
}: {
  locationId: number | null;
  onChange: (id: number | null) => void;
}) => {
  const { all, locations } = useLocations();
  const current = all.find((l) => l.id === locationId);
  const options = current?.archivedAt ? [...locations, current] : locations;
  if (options.length === 0) return null;
  return (
    <GroupedSection title="分部">
      {options.map((location) => (
        <CheckRow
          key={location.id}
          checked={location.id === locationId}
          onToggle={() => onChange(location.id)}
        >
          {location.name}
        </CheckRow>
      ))}
      <CheckRow checked={locationId === null} onToggle={() => onChange(null)}>
        <span className="text-neutral-500">不指定</span>
      </CheckRow>
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
