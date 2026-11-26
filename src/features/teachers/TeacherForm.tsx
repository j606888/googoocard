"use client";

import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import { COLOR_NAMES } from "@/features/danceStyles/PaletteColorPicker";
import { CheckRow, InlineInput } from "@/features/lessons/newLesson/grouped";
import type { LocationSummary } from "@/lib/locations";
import {
  firstFreeTeacherColor,
  TEACHER_COLOR_PRESETS,
  TEACHER_KINDS,
  TEACHER_KIND_LABELS,
  type TeacherColor,
  type TeacherKind,
} from "@/lib/teachers";
import { useGetLocationsQuery } from "@/store/slices/locations";
import {
  useCreateTeacherMutation,
  useGetTeachersQuery,
  useUpdateTeacherMutation,
  type TeacherSummary,
} from "@/store/slices/teachers";
import TeacherAvatar from "./TeacherAvatar";

const KIND_HINTS: Record<TeacherKind, string> = {
  TEACHER: "排課選老師時列出；也可以被選成別堂課的小幫手",
  ASSISTANT: "選小幫手時排在最前面；排課選老師時不列出",
  BOTH: "老師和小幫手的選單都會列出",
  NONE: "只管事、不上課：兩個選單都不列，也不在老師頁",
};

/** 抽屜裡的一組欄位：小標＋上下各一條細線的幾列（設定頁的分組清單，不包框）。 */
const Group = ({
  title,
  note,
  children,
}: {
  title?: string;
  note?: string;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-1.5">
    {title && (
      <h3 className="px-4 text-[13px] font-semibold text-ink-2">
        {title}
        {note && <span className="ml-1.5 font-normal text-ink-3">{note}</span>}
      </h3>
    )}
    <div className="divide-y divide-line border-y border-line">{children}</div>
  </section>
);

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
  teacher?: TeacherSummary & {
    note: string | null;
    kind?: TeacherKind;
    locations?: LocationSummary[];
  };
  /** After a create — the lesson form selects the new teacher. */
  onCreated?: (teacher: TeacherSummary) => void;
  /** 從點名頁「新增助教」開的：預設「助教」。 */
  defaultKind?: TeacherKind;
}) => {
  const { data: teachers = [] } = useGetTeachersQuery();
  const [name, setName] = useState(teacher?.name ?? "");
  // Derived until picked: the teacher list may still be loading when the form
  // opens, and the default should skip colours already in use.
  const [pickedColor, setColor] = useState<TeacherColor | undefined>(
    teacher?.color as TeacherColor | undefined
  );
  const { data: locationData } = useGetLocationsQuery();
  const [locationIds, setLocationIds] = useState<number[]>(
    teacher?.locations?.map((location) => location.id) ?? []
  );
  // Active branches, plus an archived one this teacher is still tagged with.
  const locationOptions = (locationData?.locations ?? []).filter(
    (location) => !location.archivedAt || locationIds.includes(location.id)
  );
  const toggleLocation = (id: number) =>
    setLocationIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const color = pickedColor ?? firstFreeTeacherColor(teachers.filter((t) => !t.archivedAt));
  // 選單只給精簡過的顏色；這位老師原本用的若不在裡面（橘、紅、被併掉的近似色）照樣列出來，不會被偷偷換掉。
  const stored = teacher?.color as TeacherColor | undefined;
  const colorOptions: readonly TeacherColor[] =
    stored && COLOR_NAMES[stored] && !(TEACHER_COLOR_PRESETS as readonly string[]).includes(stored)
      ? [stored, ...TEACHER_COLOR_PRESETS]
      : TEACHER_COLOR_PRESETS;
  const [note, setNote] = useState(teacher?.note ?? "");
  const [kind, setKind] = useState<TeacherKind>(teacher?.kind ?? defaultKind);
  const [error, setError] = useState<string>();
  const [createTeacher, { isLoading: creating }] = useCreateTeacherMutation();
  const [updateTeacher, { isLoading: updating }] = useUpdateTeacherMutation();

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("請輸入名字");
      return;
    }
    try {
      if (teacher) {
        await updateTeacher({ id: teacher.id, name: trimmed, color, locationIds, note, kind }).unwrap();
      } else {
        const created = await createTeacher({ name: trimmed, color, locationIds, note, kind }).unwrap();
        onCreated?.(created);
      }
      onClose();
    } catch {
      toast.error("儲存失敗，請稍後再試");
    }
  };

  return (
    <Drawer
      title={teacher ? `編輯 ${teacher.name}` : defaultKind === "ASSISTANT" ? "新增小幫手" : "新增老師"}
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      isLoading={creating || updating}
      submitText={teacher ? "儲存" : "新增"}
    >
      <form
        className="mb-6 flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Group>
            <InlineInput
              label="名字"
              value={name}
              maxLength={30}
              placeholder="例如 Sean"
              onChange={(value) => {
                setName(value);
                if (error) setError(undefined);
              }}
            />
          </Group>
          {error && (
            <p role="alert" className="px-4 text-[13px] text-danger-700">
              {error}
            </p>
          )}
        </div>

        <Group title="代表色" note="頭像的顏色">
          {/* 每一格就是頭像實際的樣子：淡色圓＋名字第一個字。 */}
          <div role="group" aria-label="代表色" className="flex flex-wrap gap-3 px-4 py-3">
            {colorOptions.map((key) => {
              const selected = key === color;
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={COLOR_NAMES[key]}
                  aria-pressed={selected}
                  onClick={() => setColor(key)}
                  className={`cursor-pointer rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-primary-300 focus-visible:ring-offset-2 ${
                    selected ? "ring-2 ring-ink ring-offset-2" : ""
                  }`}
                >
                  <TeacherAvatar name={name || "?"} color={key} className="size-11 text-lg" />
                </button>
              );
            })}
          </div>
        </Group>

        <Group title="身分">
          {TEACHER_KINDS.map((value) => (
            <CheckRow key={value} checked={kind === value} onToggle={() => setKind(value)} hint={KIND_HINTS[value]}>
              {TEACHER_KIND_LABELS[value]}
            </CheckRow>
          ))}
        </Group>

        {locationOptions.length > 0 && (
          <Group title="分部" note="選填，可複選">
            {locationOptions.map((location) => (
              <CheckRow
                key={location.id}
                checked={locationIds.includes(location.id)}
                onToggle={() => toggleLocation(location.id)}
              >
                {location.name}
              </CheckRow>
            ))}
          </Group>
        )}

        <Group title="備註" note="選填">
          <textarea
            aria-label="備註"
            rows={3}
            maxLength={500}
            value={note}
            placeholder="例如：週二、四晚上可排課"
            onChange={(e) => setNote(e.target.value)}
            className="block w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-3 focus-visible:bg-surface"
          />
        </Group>
      </form>
    </Drawer>
  );
};

export default TeacherForm;
