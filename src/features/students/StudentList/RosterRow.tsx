"use client";

import { AlertCircle } from "lucide-react";
import { Student } from "@/store/slices/students";
import DanceBadge from "./DanceBadge";
import {
  RECENT_ATTEND_DAYS,
  daysSinceLastAttend,
  remainingSessions,
} from "./studentFilters";

const NEEDS_RENEWAL_TAG = "Needs Renewal";

const lastAttendLabel = (days: number | null) => {
  if (days === null) return "尚未上課";
  if (days <= 0) return "今天";
  if (days === 1) return "昨天";
  return `${days} 天前`;
};

/**
 * 分割檢視左欄的一列。刻意比舊的桌面卡片密——一頁要塞得下十幾位學生，
 * 而且不用點進去就看得到剩餘堂數、最近上課、舞種資格。
 */
const RosterRow = ({
  student,
  selected,
  onSelect,
}: {
  student: Student;
  selected: boolean;
  onSelect: () => void;
}) => {
  const remaining = remainingSessions(student);
  const days = daysSinceLastAttend(student);
  const needsRenewal = student.tags?.some((tag) => tag.name === NEEDS_RENEWAL_TAG);
  const otherTag = student.tags?.find((tag) => tag.name !== NEEDS_RENEWAL_TAG);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={`w-full flex items-center gap-3 py-2.5 pr-4 pl-[13px] text-left border-l-[3px] border-b border-neutral-100 cursor-pointer transition-colors ${
        selected
          ? "border-l-primary-500 bg-primary-50"
          : "border-l-transparent hover:bg-neutral-50"
      }`}
    >
      <img
        src={student.avatarUrl}
        alt=""
        className="w-10 h-10 rounded-full object-cover shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <h3
            className={`text-[15px] font-semibold truncate ${
              selected ? "text-primary-900" : "text-neutral-900"
            }`}
          >
            {student.name}
          </h3>
          <span className="text-[11px] font-mono text-neutral-400 shrink-0">
            #{student.number}
          </span>
          {otherTag && (
            <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
              {otherTag.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-neutral-500">
          {needsRenewal && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger-100 text-danger-700 text-[11px] font-medium">
              <AlertCircle className="w-3 h-3" />
              需續約
            </span>
          )}
          {remaining > 0 && (
            <span className={remaining <= 2 ? "text-danger-600 font-medium" : ""}>
              剩 {remaining} 堂
            </span>
          )}
          {remaining > 0 && <span className="text-neutral-300">·</span>}
          <span
            className={days !== null && days > RECENT_ATTEND_DAYS ? "text-neutral-400" : ""}
          >
            {lastAttendLabel(days)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {student.danceQualifications?.map((type) => (
          <DanceBadge key={type} type={type} />
        ))}
      </div>
    </button>
  );
};

export default RosterRow;
