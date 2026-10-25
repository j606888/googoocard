"use client";

import Link from "next/link";
import DataView, { DataViewColumn } from "@/components/DataView";
import { Student } from "@/store/slices/students";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { heatLevel } from "../StudentDetail/AttendSection/attendanceInsights";
import { HEAT } from "../StudentDetail/AttendSection/AttendInsights";
import { DanceBadges } from "./DanceBadge";
import {
  ACTIVE_DAYS,
  LOW_REMAINING_SESSIONS,
  NEEDS_RENEWAL_TAG,
  ROSTER_WEEKS,
  daysSinceLastAttend,
  lastAttendLabel,
  recentWeeks,
  remainingSessions,
} from "./studentFilters";

/** 近 8 週每週一格，跟詳情頁的 13 週方格同一組深淺。 */
const WeekDots = ({ student }: { student: Student }) => {
  const counts = recentWeeks(student);
  const total = counts.reduce((sum, count) => sum + count, 0);
  return (
    <span
      role="img"
      aria-label={`近 ${ROSTER_WEEKS} 週出席 ${total} 堂`}
      className="inline-grid gap-[3px]"
      style={{ gridTemplateColumns: `repeat(${ROSTER_WEEKS}, minmax(0, 1fr))` }}
    >
      {counts.map((count, index) => (
        <span
          key={index}
          title={`${count} 堂`}
          className={`block w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-[3px] ${HEAT[heatLevel(count)]}`}
        />
      ))}
    </span>
  );
};

/**
 * 學生名單的表格（手機是卡片、桌面是表格，同一份 DOM，見 `DataView`）。
 *
 * 整列可點：primary 那格是真的 `<Link>`（手機，進整頁詳情）或 `<button>`
 * （桌面，開右側抽屜），用 `after:absolute after:inset-0` 撐滿整列，鍵盤也點得到。
 */
const StudentTable = ({
  students,
  selectedId = null,
  onSelect,
  hideHeader = false,
}: {
  students: Student[];
  selectedId?: number | null;
  /** 有給就是桌面抽屜模式（按鈕）；沒給就是手機（連到學生頁）。 */
  onSelect?: (student: Student) => void;
  hideHeader?: boolean;
}) => {
  const stretched =
    "flex items-center gap-3 min-w-0 text-left cursor-pointer after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary-500 focus-visible:after:ring-inset";

  const columns: DataViewColumn<Student>[] = [
    {
      key: "name",
      header: "學生",
      width: "minmax(200px,2.2fr)",
      role: "primary",
      render: (student) => {
        const otherTag = student.tags?.find((tag) => tag.name !== NEEDS_RENEWAL_TAG);
        const body = (
          <>
            <img src={student.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="text-[15px] font-semibold text-neutral-900 truncate">{student.name}</span>
              <span className="text-[11px] font-mono text-neutral-400 shrink-0">#{student.number}</span>
              {otherTag && (
                <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                  {otherTag.name}
                </span>
              )}
            </span>
          </>
        );
        return onSelect ? (
          <button
            type="button"
            onClick={() => onSelect(student)}
            aria-current={student.id === selectedId ? "true" : undefined}
            className={stretched}
          >
            {body}
          </button>
        ) : (
          <Link href={`/students/${student.id}`} className={stretched}>
            {body}
          </Link>
        );
      },
    },
    {
      key: "styles",
      header: "舞種",
      width: "minmax(0,1.3fr)",
      hideOnMobile: (student) => Object.keys(student.danceLevels ?? {}).length === 0,
      render: (student) => (
        <span className="flex flex-wrap gap-1">
          <DanceBadges levels={student.danceLevels} />
        </span>
      ),
    },
    {
      key: "remaining",
      header: "剩餘",
      width: "80px",
      render: (student) => {
        const remaining = remainingSessions(student);
        return (
          <span
            className={cn(
              "tabular-nums",
              remaining === 0
                ? "text-neutral-400"
                : remaining <= LOW_REMAINING_SESSIONS
                  ? "text-danger-700 font-semibold"
                  : "text-neutral-900 lg:font-semibold"
            )}
          >
            剩 {remaining} 堂
          </span>
        );
      },
    },
    {
      key: "last",
      header: "最近上課",
      width: "96px",
      render: (student) => {
        const days = daysSinceLastAttend(student);
        return (
          <span className={days === null || days > ACTIVE_DAYS ? "text-neutral-400" : ""}>
            {lastAttendLabel(days)}
          </span>
        );
      },
    },
    {
      key: "weeks",
      header: `近 ${ROSTER_WEEKS} 週出席`,
      width: "128px",
      render: (student) => <WeekDots student={student} />,
    },
    {
      key: "status",
      header: "狀態",
      width: "minmax(0,1fr)",
      role: "trailing",
      render: (student) => {
        const needsRenewal = student.tags?.some((tag) => tag.name === NEEDS_RENEWAL_TAG);
        const unpaid = student.unpaidAmount ?? 0;
        return (
          <span className="flex flex-wrap justify-end lg:justify-start gap-1">
            {needsRenewal && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-danger-100 text-danger-700">
                需續約
              </span>
            )}
            {student.hasUnpaidCard && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-warning-100 text-warning-900">
                未付{unpaid > 0 ? ` $${formatMoney(unpaid)}` : ""}
              </span>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <DataView
      columns={columns}
      rows={students}
      rowKey={(student) => student.id}
      hideHeader={hideHeader}
      className="rounded-none border-x-0 lg:rounded-2xl lg:border-x"
      rowClassName={(student) =>
        cn(
          "hover:bg-neutral-50",
          student.id === selectedId && "bg-primary-50 hover:bg-primary-50"
        )
      }
    />
  );
};

export default StudentTable;
