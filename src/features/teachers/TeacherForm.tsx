"use client";

import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import Field, { FieldLabel, fieldControlClass } from "@/components/Field";
import SegmentedTabs from "@/components/SegmentedTabs";
import PaletteColorPicker from "@/features/danceStyles/PaletteColorPicker";
import type { DanceStyleColor } from "@/lib/danceStyles";
import { firstFreeTeacherColor, TEACHER_KINDS, TEACHER_KIND_LABELS, type TeacherKind } from "@/lib/teachers";
import {
  useCreateTeacherMutation,
  useGetTeachersQuery,
  useUpdateTeacherMutation,
  type TeacherSummary,
} from "@/store/slices/teachers";

const KIND_HINTS: Record<TeacherKind, string> = {
  TEACHER: "只教課：點名選「今天的助教」時不會列出。",
  ASSISTANT: "只當助教：排課選老師時不會列出；選助教時排在最前面。",
  BOTH: "排課和選助教時都會列出。",
};

/**
 * Create (`teacher` undefined) or edit a teacher. Mount it with a `key` per
 * open so the fields start from the teacher being edited.
 */
const TeacherForm = ({
  open,
  onClose,
  teacher,
  onCreated,
  defaultKind = "TEACHER",
}: {
  open: boolean;
  onClose: () => void;
  teacher?: TeacherSummary & { note: string | null; kind?: TeacherKind };
  /** After a create — the lesson form selects the new teacher. */
  onCreated?: (teacher: TeacherSummary) => void;
  /** 從點名頁「新增助教」開的：預設「助教」。 */
  defaultKind?: TeacherKind;
}) => {
  const { data: teachers = [] } = useGetTeachersQuery();
  const [name, setName] = useState(teacher?.name ?? "");
  // Derived until picked: the teacher list may still be loading when the form
  // opens, and the default should skip colours already in use.
  const [pickedColor, setColor] = useState<DanceStyleColor | undefined>(
    teacher?.color as DanceStyleColor | undefined
  );
  const color = pickedColor ?? firstFreeTeacherColor(teachers.filter((t) => !t.archivedAt));
  const [note, setNote] = useState(teacher?.note ?? "");
  const [kind, setKind] = useState<TeacherKind>(teacher?.kind ?? defaultKind);
  const [error, setError] = useState<string>();
  const [createTeacher, { isLoading: creating }] = useCreateTeacherMutation();
  const [updateTeacher, { isLoading: updating }] = useUpdateTeacherMutation();

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("請輸入老師名字");
      return;
    }
    try {
      if (teacher) {
        await updateTeacher({ id: teacher.id, name: trimmed, color, note, kind }).unwrap();
      } else {
        const created = await createTeacher({ name: trimmed, color, note, kind }).unwrap();
        onCreated?.(created);
      }
      onClose();
    } catch {
      toast.error("儲存失敗，請稍後再試");
    }
  };

  return (
    <Drawer
      title={teacher ? `編輯 ${teacher.name}` : defaultKind === "ASSISTANT" ? "新增助教" : "新增老師"}
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      isLoading={creating || updating}
      submitText={teacher ? "儲存" : "新增"}
    >
      <form
        className="mb-6 flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <Field
          label="名字"
          value={name}
          placeholder="例如 Sean"
          error={error}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(undefined);
          }}
        />

        <PaletteColorPicker
          label="代表色"
          hint="（頭像用這個顏色）"
          value={color}
          onChange={setColor}
        />

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="teacher-note" hint="（選填）">
            備註
          </FieldLabel>
          <textarea
            id="teacher-note"
            rows={3}
            maxLength={500}
            value={note}
            placeholder="例如：週二、四晚上可排課"
            onChange={(e) => setNote(e.target.value)}
            className={`${fieldControlClass()} py-3 resize-none`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>身分</FieldLabel>
          <SegmentedTabs
            ariaLabel="身分"
            fill
            options={TEACHER_KINDS.map((value) => ({ value, label: TEACHER_KIND_LABELS[value] }))}
            value={kind}
            onChange={setKind}
          />
          <p className="text-[13px] text-neutral-500 leading-relaxed">{KIND_HINTS[kind]}</p>
        </div>
      </form>
    </Drawer>
  );
};

export default TeacherForm;
