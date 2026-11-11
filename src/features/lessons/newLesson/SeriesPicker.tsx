import { useId } from "react";
import Field, { FieldError, FieldLabel } from "@/components/Field";
import Select from "@/components/Select";
import { useGetLessonGroupsQuery } from "@/store/slices/lessonGroups";

/** 這一期屬於哪個課種：現有的、或當場取名的新課種。 */
export type SeriesChoice = { type: "existing"; id: number } | { type: "new"; name: string } | null;

const NEW = -1;

/**
 * 新增課程的第一個欄位：開哪一個課種。課名預設就是課種名稱（`lessonNameFor`），
 * 要另取這一期的名稱由呼叫端顯示。選現有的會標「這是第 N 期」。
 */
export default function SeriesPicker({
  value,
  onChange,
  error,
}: {
  value: SeriesChoice;
  onChange: (choice: SeriesChoice) => void;
  error?: string;
}) {
  const id = useId();
  const { data: groups = [] } = useGetLessonGroupsQuery();
  const picked = value?.type === "existing" ? groups.find((g) => g.id === value.id) : undefined;
  const selectValue = value?.type === "existing" ? value.id : value?.type === "new" ? NEW : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={id}>課種</FieldLabel>
        {picked && (
          <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-800">
            這是第 {picked.lessonCount + 1} 期
          </span>
        )}
      </div>
      <Select<number>
        id={id}
        value={selectValue}
        error={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        placeholder="選一個課種"
        onChange={(next) => onChange(next === NEW ? { type: "new", name: "" } : { type: "existing", id: next })}
        options={[
          ...groups.map((g) => ({
            value: g.id,
            label: g.name,
            hint: g.lessonCount > 0 ? `開過 ${g.lessonCount} 期` : undefined,
          })),
          { value: NEW, label: "＋ 新課種" },
        ]}
      />
      {value?.type === "new" && (
        <Field
          label="新課種的名稱"
          className="mt-2"
          placeholder="例如：Bachata Lv1"
          maxLength={60}
          value={value.name}
          onChange={(e) => onChange({ type: "new", name: e.target.value })}
        />
      )}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

/** The series' own name for a choice (what the lesson is called unless renamed). */
export function seriesName(choice: SeriesChoice, groups: { id: number; name: string }[]): string {
  if (!choice) return "";
  if (choice.type === "new") return choice.name.trim();
  return groups.find((g) => g.id === choice.id)?.name ?? "";
}
