"use client";

import EmptyState from "@/components/EmptyState";
import type { ClassroomChoice } from "./useLiffClassroomData";

/** Several public classrooms and the visitor hasn't picked one yet. */
export default function ClassroomPicker({
  classrooms,
  onPick,
}: {
  classrooms: ClassroomChoice[];
  onPick: (id: number) => void;
}) {
  if (classrooms.length === 0) return <EmptyState kind="inline" title="目前還沒有公開的教室。" />;
  return (
    <div className="flex flex-col gap-3 px-4 py-5">
      <h3 className="font-semibold text-neutral-900">要看哪一間教室？</h3>
      {classrooms.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick(c.id)}
          className="rounded-xl border border-neutral-200 bg-white p-4 text-left font-semibold text-neutral-900 active:bg-neutral-50"
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
