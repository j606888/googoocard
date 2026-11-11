"use client";

import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import Field, { FieldLabel, fieldControlClass } from "@/components/Field";
import SegmentedTabs from "@/components/SegmentedTabs";
import PaletteColorPicker from "@/features/danceStyles/PaletteColorPicker";
import { danceStyleClasses } from "@/lib/danceStyleColors";
import { TEACHER_ICON_GLYPHS } from "./teacherIcons";
import type { LocationSummary } from "@/lib/locations";
import {
  firstFreeTeacherColor,
  teacherInitial,
  TEACHER_COLORS,
  TEACHER_ICONS,
  TEACHER_KINDS,
  TEACHER_KIND_LABELS,
  type TeacherColor,
  type TeacherIcon,
  type TeacherKind,
} from "@/lib/teachers";
import { useGetLocationsQuery } from "@/store/slices/locations";
import {
  useCreateTeacherMutation,
  useGetTeachersQuery,
  useUpdateTeacherMutation,
  type TeacherSummary,
} from "@/store/slices/teachers";

// 「今天的助教」2026-11-01 已移除：身分現在只決定排課的老師選單列不列（`canTeach`）。
const KIND_HINTS: Record<TeacherKind, string> = {
  TEACHER: "排課選老師時列出；也可以被選成別堂課的小幫手。",
  ASSISTANT: "選課程小幫手時排在最前面；排課選老師時不列出。",
  BOTH: "老師和小幫手的選單都會列出。",
  NONE: "只管事、不上課：老師和小幫手的選單都不列，也不在老師頁。",
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
  teacher?: TeacherSummary & {
    note: string | null;
    kind?: TeacherKind;
    icon?: string | null;
    locations?: LocationSummary[];
  };
  /** After a create — the lesson form selects the new teacher. */
  onCreated?: (teacher: TeacherSummary) => void;
  /** 預設身分；傳 "ASSISTANT" 時標題是「新增助教」。 */
  defaultKind?: TeacherKind;
}) => {
  const { data: teachers = [] } = useGetTeachersQuery();
  const [name, setName] = useState(teacher?.name ?? "");
  // Derived until picked: the teacher list may still be loading when the form
  // opens, and the default should skip colours already in use.
  const [pickedColor, setColor] = useState<TeacherColor | undefined>(
    teacher?.color as TeacherColor | undefined
  );
  const [icon, setIcon] = useState<TeacherIcon | null>((teacher?.icon as TeacherIcon) ?? null);
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
        await updateTeacher({ id: teacher.id, name: trimmed, color, icon, locationIds, note, kind }).unwrap();
      } else {
        const created = await createTeacher({ name: trimmed, color, icon, locationIds, note, kind }).unwrap();
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
          colors={TEACHER_COLORS}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-neutral-900">
            圖示
            <span className="ml-1 text-sm font-normal text-neutral-500">（選填，不選就用名字第一個字）</span>
          </legend>
          <div className="grid grid-cols-7 gap-2 p-1">
            {[null, ...TEACHER_ICONS].map((option) => {
              const selected = option === icon;
              const glyph = option ? TEACHER_ICON_GLYPHS[option] : null;
              const palette = danceStyleClasses(color);
              return (
                <button
                  key={option ?? "initial"}
                  type="button"
                  title={glyph?.label ?? "名字第一個字"}
                  aria-label={glyph?.label ?? "用名字第一個字"}
                  aria-pressed={selected}
                  onClick={() => setIcon(option)}
                  className={`h-11 rounded-lg flex items-center justify-center cursor-pointer leading-none ${
                    glyph
                      ? selected
                        ? palette.badge
                        : "bg-neutral-50 text-neutral-700 hover:bg-neutral-100"
                      : `${palette.bg} text-base font-semibold text-white`
                  } ${selected ? "ring-2 ring-offset-2 ring-neutral-900" : ""}`}
                >
                  {glyph ? <glyph.Icon className="size-5" strokeWidth={1.75} /> : teacherInitial(name || "?")}
                </button>
              );
            })}
          </div>
        </fieldset>

        {locationOptions.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-neutral-900">
              分部
              <span className="ml-1 text-sm font-normal text-neutral-500">（選填，可複選）</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {locationOptions.map((location) => {
                const selected = locationIds.includes(location.id);
                return (
                  <button
                    key={location.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleLocation(location.id)}
                    className={`h-10 px-4 rounded-full border text-sm font-medium cursor-pointer ${
                      selected
                        ? "border-primary-600 bg-primary-50 text-primary-700"
                        : "border-neutral-300 bg-white text-neutral-700"
                    }`}
                  >
                    {location.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

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
