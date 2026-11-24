"use client";

import { useMemo, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { useGetStudentsQuery } from "@/store/slices/students";
import { Button } from "@/components/ui/button";
import { fieldControlClass } from "@/components/Field";
import { cn } from "@/lib/utils";

export type Who = { kind: "existing"; id: number; name: string } | { kind: "new"; name: string };

const SUGGESTION_LIMIT = 5;

/** API 的「既有學生或新名字」二擇一。 */
export const whoBody = (who: Who) =>
  who.kind === "existing" ? { studentId: who.id } : { newStudentName: who.name };

/**
 * 選一位學生：打名字找既有學生，或直接新增（同名不擋，交給待處理「可能重複」）。
 * 預計會來的兩個入口（課程頁、點名頁）共用。
 */
const StudentPickField = ({
  who,
  onChange,
  excludeIds = [],
  invalid = false,
}: {
  who: Who | null;
  onChange: (who: Who | null) => void;
  /** 已經在名單上的人不再列出來。 */
  excludeIds?: number[];
  invalid?: boolean;
}) => {
  const { data: students = [] } = useGetStudentsQuery();
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const suggestions = useMemo(() => {
    if (!trimmed) return [];
    const needle = trimmed.toLowerCase();
    return students
      .filter((s) => !excludeIds.includes(s.id) && s.name.toLowerCase().includes(needle))
      .slice(0, SUGGESTION_LIMIT);
  }, [students, trimmed, excludeIds]);
  const exactMatch = suggestions.some((s) => s.name === trimmed);

  if (who) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-primary-300 bg-primary-50 px-3 py-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold">{who.name}</span>
          {who.kind === "new" && <span className="shrink-0 text-xs text-neutral-600">新學員，會一起建立</span>}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="iconSm"
          aria-label="換一位"
          onClick={() => onChange(null)}
          className="text-neutral-600 hover:bg-white"
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="輸入姓名"
        aria-label="學員姓名"
        className={cn(fieldControlClass(invalid), "h-12")}
      />
      {trimmed && (
        <ul className="flex flex-col overflow-hidden rounded-xl border border-neutral-200">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onChange({ kind: "existing", id: s.id, name: s.name })}
                className="flex w-full cursor-pointer items-center gap-2.5 border-b border-neutral-100 px-3 py-2.5 text-left hover:bg-neutral-50"
              >
                <img src={s.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                <span className="font-medium">{s.name}</span>
                <span className="ml-auto text-xs text-neutral-500">#{s.number}</span>
              </button>
            </li>
          ))}
          {!exactMatch && (
            <li>
              <button
                type="button"
                onClick={() => onChange({ kind: "new", name: trimmed })}
                className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left text-primary-900 hover:bg-primary-50"
              >
                <UserPlus className="h-4 w-4" />
                新增「{trimmed}」為新學員
              </button>
            </li>
          )}
        </ul>
      )}
    </>
  );
};

export default StudentPickField;
