"use client";

import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import Field, { FieldLabel, fieldControlClass } from "@/components/Field";
import { Switch } from "@/components/ui/switch";
import PaletteColorPicker from "@/features/danceStyles/PaletteColorPicker";
import type { DanceStyleColor } from "@/lib/danceStyles";
import { firstFreeTeacherColor } from "@/lib/teachers";
import {
  useCreateTeacherMutation,
  useGetTeachersQuery,
  useUpdateTeacherMutation,
  type TeacherSummary,
} from "@/store/slices/teachers";

/**
 * Create (`teacher` undefined) or edit a teacher. Mount it with a `key` per
 * open so the fields start from the teacher being edited.
 */
const TeacherForm = ({
  open,
  onClose,
  teacher,
  onCreated,
  defaultIsAssistant = false,
}: {
  open: boolean;
  onClose: () => void;
  teacher?: TeacherSummary & { note: string | null; isAssistant?: boolean };
  /** After a create — the lesson form selects the new teacher. */
  onCreated?: (teacher: TeacherSummary) => void;
  /** 從點名頁「新增助教」開的：預設勾「只當助教」。 */
  defaultIsAssistant?: boolean;
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
  const [isAssistant, setIsAssistant] = useState(teacher?.isAssistant ?? defaultIsAssistant);
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
        await updateTeacher({ id: teacher.id, name: trimmed, color, note, isAssistant }).unwrap();
      } else {
        const created = await createTeacher({ name: trimmed, color, note, isAssistant }).unwrap();
        onCreated?.(created);
      }
      onClose();
    } catch {
      toast.error("儲存失敗，請稍後再試");
    }
  };

  return (
    <Drawer
      title={teacher ? `編輯 ${teacher.name}` : defaultIsAssistant ? "新增助教" : "新增老師"}
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
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={isAssistant} onCheckedChange={setIsAssistant} />
            <span className="text-sm font-medium text-neutral-900">只當助教</span>
          </label>
          <p className="text-[13px] text-neutral-500 leading-relaxed pl-10">
            排課選老師時不會列出；點名選「今天的助教」時排在最前面。
          </p>
        </div>
      </form>
    </Drawer>
  );
};

export default TeacherForm;
