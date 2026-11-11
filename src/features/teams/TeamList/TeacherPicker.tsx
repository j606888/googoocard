import { useId } from "react";
import Field, { FieldError, FieldLabel } from "@/components/Field";
import Select from "@/components/Select";
import { TEACHER_KIND_LABELS, type TeacherKind } from "@/lib/teachers";
import { useCreateTeacherMutation, useGetTeachersQuery } from "@/store/slices/teachers";

/** Which Teacher row a member is: an existing one, a new one by name, or none. */
export type TeacherChoice =
  | { kind: "none" }
  | { kind: "existing"; id: number }
  | { kind: "new"; name: string };

const NEW = "new";
const NONE = "";

/**
 * 成員連到名冊上的哪一筆人員資料。列出還沒連給別人的人（`forUserId` 自己那筆也列），
 * 加上「新增人員」。只有在名冊上本來就有他（加入前先建好的）時才需要改。
 */
export default function TeacherPicker({
  value,
  onChange,
  forUserId,
  error,
}: {
  value: TeacherChoice;
  onChange: (choice: TeacherChoice) => void;
  forUserId: number | null;
  error?: string;
}) {
  const id = useId();
  const { data: teachers } = useGetTeachersQuery();
  const unlinked = (teachers ?? []).filter(
    (t) => !t.archivedAt && (t.userId === null || t.userId === forUserId)
  );
  const linkable = unlinked;
  const selectValue =
    value.kind === "existing" ? String(value.id) : value.kind === "new" ? NEW : NONE;

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id}>他是名冊上的哪一位？</FieldLabel>
      <Select
        id={id}
        value={selectValue}
        error={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        placeholder="選擇人員"
        onChange={(v) => {
          onChange(
            v === NEW ? { kind: "new", name: "" } : v === NONE ? { kind: "none" } : { kind: "existing", id: Number(v) }
          );
        }}
        options={[
          ...linkable.map((t) => ({
            value: String(t.id),
            label: t.name,
            hint: TEACHER_KIND_LABELS[t.kind],
          })),
          { value: NEW, label: "＋ 新增人員" },
        ]}
      />
      {value.kind === "new" && (
        <Field
          label="名字"
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
        <p className="text-xs text-neutral-500">
          通常不用改。名冊上本來就有他（加入前先建好、有上課紀錄）時，改連過去，加入時自動建的那筆會收起來。
        </p>
      )}
    </div>
  );
}

/** A picker error for a choice that can't be submitted yet, or undefined. */
export function teacherChoiceError(choice: TeacherChoice, required: boolean): string | undefined {
  if (choice.kind === "none") return required ? "請選一筆人員資料" : undefined;
  if (choice.kind === "new" && !choice.name.trim()) return "請輸入名字";
  return undefined;
}

/** Turns a choice into a teacher id, creating the teacher first for「新增老師」. */
export function useResolveTeacherChoice() {
  const [createTeacher] = useCreateTeacherMutation();
  /** `newKind` — what a teacher created on the spot is (a 小幫手's new row is 助教). */
  return async (choice: TeacherChoice, newKind?: TeacherKind): Promise<number | null> => {
    if (choice.kind === "none") return null;
    if (choice.kind === "existing") return choice.id;
    const created = await createTeacher({ name: choice.name.trim(), kind: newKind }).unwrap();
    return created.id;
  };
}

export function initialTeacherChoice(teacherId: number | null | undefined): TeacherChoice {
  return teacherId ? { kind: "existing", id: teacherId } : { kind: "none" };
}
