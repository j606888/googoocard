"use client";

import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import InputField from "@/components/InputField";
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
}: {
  open: boolean;
  onClose: () => void;
  teacher?: TeacherSummary & { note: string | null };
  /** After a create — the lesson form selects the new teacher. */
  onCreated?: (teacher: TeacherSummary) => void;
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
        await updateTeacher({ id: teacher.id, name: trimmed, color, note }).unwrap();
      } else {
        const created = await createTeacher({ name: trimmed, color, note }).unwrap();
        onCreated?.(created);
      }
      onClose();
    } catch {
      toast.error("儲存失敗，請稍後再試");
    }
  };

  return (
    <Drawer
      title={teacher ? `編輯 ${teacher.name}` : "新增老師"}
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
        <InputField
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

        <div className="flex flex-col">
          <label htmlFor="teacher-note" className="mb-2 font-medium">
            備註
            <span className="ml-1 text-sm font-normal text-neutral-500">（選填）</span>
          </label>
          <textarea
            id="teacher-note"
            rows={3}
            maxLength={500}
            value={note}
            placeholder="例如：週二、四晚上可排課"
            onChange={(e) => setNote(e.target.value)}
            className="w-full p-2 rounded bg-neutral-100 focus:outline-primary-500 resize-none"
          />
        </div>
      </form>
    </Drawer>
  );
};

export default TeacherForm;
