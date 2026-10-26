import { useId } from "react";
import Field, { FieldError, FieldLabel, fieldControlClass } from "@/components/Field";
import { cn } from "@/lib/utils";
import { useCreateTeacherMutation, useGetTeachersQuery } from "@/store/slices/teachers";

/** Which Teacher row a member is: an existing one, a new one by name, or none. */
export type TeacherChoice =
  | { kind: "none" }
  | { kind: "existing"; id: number }
  | { kind: "new"; name: string };

const NEW = "new";
const NONE = "";

/**
 * Picks the Teacher row a member is linked to. Lists active teachers nobody
 * else is linked to (`forUserId`'s own link stays pickable), plus「新增老師」.
 * `optional` adds 不連結 (an admin needn't teach).
 */
export default function TeacherPicker({
  value,
  onChange,
  forUserId,
  optional = false,
  error,
}: {
  value: TeacherChoice;
  onChange: (choice: TeacherChoice) => void;
  forUserId: number | null;
  optional?: boolean;
  error?: string;
}) {
  const id = useId();
  const { data: teachers } = useGetTeachersQuery();
  const linkable = (teachers ?? []).filter(
    (t) => !t.archivedAt && (t.userId === null || t.userId === forUserId)
  );
  const selectValue =
    value.kind === "existing" ? String(value.id) : value.kind === "new" ? NEW : NONE;

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id}>他是哪一位老師？</FieldLabel>
      <select
        id={id}
        className={cn(fieldControlClass(!!error), "h-12")}
        value={selectValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => {
          const v = e.target.value;
          onChange(
            v === NEW ? { kind: "new", name: "" } : v === NONE ? { kind: "none" } : { kind: "existing", id: Number(v) }
          );
        }}
      >
        <option value={NONE} disabled={!optional}>
          {optional ? "不連結" : "選擇老師"}
        </option>
        {linkable.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.activeLessonCount > 0 ? `（${t.activeLessonCount} 堂進行中）` : ""}
          </option>
        ))}
        <option value={NEW}>＋ 新增老師</option>
      </select>
      {value.kind === "new" && (
        <Field
          label="新老師的名字"
          className="mt-2"
          placeholder="例如：小美"
          maxLength={30}
          value={value.name}
          onChange={(e) => onChange({ kind: "new", name: e.target.value })}
        />
      )}
      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : (
        <p className="text-xs text-neutral-500">掛著這位老師的課，會出現在他的課程頁最上面。</p>
      )}
    </div>
  );
}

/** A picker error for a choice that can't be submitted yet, or undefined. */
export function teacherChoiceError(choice: TeacherChoice, required: boolean): string | undefined {
  if (choice.kind === "none") return required ? "老師要連結一筆老師資料" : undefined;
  if (choice.kind === "new" && !choice.name.trim()) return "請輸入老師的名字";
  return undefined;
}

/** Turns a choice into a teacher id, creating the teacher first for「新增老師」. */
export function useResolveTeacherChoice() {
  const [createTeacher] = useCreateTeacherMutation();
  return async (choice: TeacherChoice): Promise<number | null> => {
    if (choice.kind === "none") return null;
    if (choice.kind === "existing") return choice.id;
    const created = await createTeacher({ name: choice.name.trim() }).unwrap();
    return created.id;
  };
}

export function initialTeacherChoice(teacherId: number | null | undefined): TeacherChoice {
  return teacherId ? { kind: "existing", id: teacherId } : { kind: "none" };
}
