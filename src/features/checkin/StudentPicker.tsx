"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Search } from "lucide-react";

export interface CheckinStudent {
  id: number;
  name: string;
  avatarUrl: string;
  number: number;
}

// Step 1 of the public QR check-in: the student finds themselves in the roster.
// There is deliberately no verification here — the studio trusts students to
// only sign themselves in, and a 助教 reviews the period before finalizing.
const StudentPicker = ({
  students,
  onSelect,
}: {
  students: CheckinStudent[];
  onSelect: (student: CheckinStudent) => void;
}) => {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || String(s.number).includes(q)
    );
  }, [students, query]);

  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      <div>
        <h2 className="text-lg font-semibold">請選擇你是誰</h2>
        <p className="mt-1 text-sm text-neutral-500">找不到自己的名字嗎？請找助教協助。</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋姓名或編號"
          className="w-full rounded-xl border border-neutral-200 py-3 pl-9 pr-3 text-base outline-none focus:border-primary-500"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-500">找不到符合的名字</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((student) => (
            <button
              key={student.id}
              onClick={() => onSelect(student)}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3 text-left active:bg-neutral-50"
            >
              <Image
                className="rounded-full object-cover"
                width={36}
                height={36}
                src={student.avatarUrl}
                alt={student.name}
              />
              <span className="text-base font-medium">{student.name}</span>
              <span className="ml-auto text-xs font-mono text-neutral-400">#{student.number}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentPicker;
