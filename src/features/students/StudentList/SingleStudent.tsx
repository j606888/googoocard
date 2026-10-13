"use client";

import Link from "next/link";
import { Student } from "@/store/slices/students";
import { DanceBadges } from "./DanceBadge";
import {
  LOW_REMAINING_SESSIONS,
  NEEDS_RENEWAL_TAG,
  RECENT_ATTEND_DAYS,
  daysSinceLastAttend,
  lastAttendLabel,
  remainingSessions,
} from "./studentFilters";

/**
 * 手機版列表的一列：剩幾堂、多久沒來一眼看到；需續約和舞種放右邊。
 * 桌面版走分割檢視（見 StudentsSplitView / RosterRow），不共用這個元件。
 */
const SingleStudent = ({ student }: { student: Student }) => {
  const remaining = remainingSessions(student);
  const days = daysSinceLastAttend(student);
  const needsRenewal = student.tags?.some((tag) => tag.name === NEEDS_RENEWAL_TAG);
  const otherTag = student.tags?.find((tag) => tag.name !== NEEDS_RENEWAL_TAG);

  return (
    <Link
      href={`/students/${student.id}`}
      className="flex items-center gap-3 min-h-16 px-4 py-3 border-b border-neutral-100 hover:bg-neutral-50"
    >
      <img src={student.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold truncate">{student.name}</span>
          <span className="text-[11px] font-mono text-neutral-400 shrink-0">#{student.number}</span>
          {otherTag && (
            <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
              {otherTag.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-px text-[13px] text-neutral-500">
          <span
            className={remaining <= LOW_REMAINING_SESSIONS ? "text-danger-700 font-semibold" : ""}
          >
            剩 {remaining} 堂
          </span>
          <span className="text-neutral-300">·</span>
          <span className={days !== null && days > RECENT_ATTEND_DAYS ? "text-neutral-400" : ""}>
            {lastAttendLabel(days)}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {needsRenewal && (
          <span className="text-[11px] font-semibold px-2 py-px rounded-full bg-danger-100 text-danger-700">
            需續約
          </span>
        )}
        <div className="flex flex-wrap justify-end gap-1">
          <DanceBadges levels={student.danceLevels} />
        </div>
      </div>
    </Link>
  );
};

export default SingleStudent;
