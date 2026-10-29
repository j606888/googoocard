import { useState } from "react";
import { format } from "date-fns";
import type { StudentAttendance } from "@/store/slices/students";
import DanceBadge from "../../StudentList/DanceBadge";
import { formatCardSerial } from "@/lib/cardSerial";
import { formatMoney } from "@/lib/money";
import { attendanceSourceLabel, groupByMonth, takeMonthsUntil } from "./attendanceInsights";
import StatusTag, { type StatusTone } from "@/components/StatusTag";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 第一次先列到這麼多筆（整月為單位），其餘收在「載入更早的紀錄」後面。 */
const INITIAL_ROWS = 20;

const SOURCE_TONE: Record<"self" | "teacher" | "pending", StatusTone> = {
  self: "outline",
  teacher: "neutral",
  pending: "warning",
};

export const SourcePill = ({ attendance }: { attendance: Pick<StudentAttendance, "source" | "pending"> }) => {
  const { label, tone } = attendanceSourceLabel(attendance);
  return (
    <StatusTag tone={SOURCE_TONE[tone]} className="justify-self-start">
      {label}
    </StatusTag>
  );
};

const ROW_COLS = "@lg:grid-cols-[88px_minmax(0,1.4fr)_minmax(0,1fr)_104px]";

/**
 * 依日期：以月份分段的出席列——日期＋星期時間、課名＋舞種、扣了哪張卡、來源。
 * 寬的槽位是四欄表格，窄的收成「日期／課名＋卡號／來源」三欄。
 */
const AttendanceByDate = ({ attendances }: { attendances: StudentAttendance[] }) => {
  const [showAll, setShowAll] = useState(false);
  const groups = groupByMonth(attendances);
  // 整月整月地顯示：至少列到 INITIAL_ROWS 筆才停。
  const visibleGroups = showAll ? groups : takeMonthsUntil(groups, INITIAL_ROWS);
  const hiddenCount = attendances.length - visibleGroups.reduce((sum, g) => sum + g.attendances.length, 0);

  return (
    <div className="@container">
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        {visibleGroups.map((group) => (
          <section key={group.key}>
            <h4 className="m-0 flex items-center justify-between px-4 py-2 bg-neutral-50 border-y first:border-t-0 border-neutral-100 text-xs font-semibold text-neutral-700">
              {group.label}
              <span className="font-medium text-neutral-500">{group.attendances.length} 堂</span>
            </h4>
            <ul className="m-0 p-0 list-none">
              {group.attendances.map((attendance, index) => {
                const at = new Date(attendance.startTime);
                const serial = attendance.studentCard ? formatCardSerial(attendance.studentCard.serialNumber) : null;
                return (
                  <li
                    key={`${attendance.lessonId}-${attendance.startTime}-${index}`}
                    className={`grid grid-cols-[52px_minmax(0,1fr)_auto] ${ROW_COLS} gap-3 items-center px-4 py-2.5 border-t first:border-t-0 border-neutral-100 text-[13px] text-neutral-700`}
                  >
                    <span className="leading-tight">
                      <span className="block text-[15px] font-semibold text-neutral-900 tabular-nums">{format(at, "M/d")}</span>
                      <span className="block text-xs text-neutral-500">
                        週{WEEKDAYS[at.getDay()]}
                        <span className="hidden @lg:inline"> {format(at, "HH:mm")}</span>
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 flex-wrap font-semibold text-neutral-900">
                        <span className="truncate">{attendance.lessonName}</span>
                        {attendance.danceStyle && <DanceBadge style={attendance.danceStyle} />}
                      </span>
                      {/* 窄槽位：時間和卡號併到課名下面 */}
                      <span className="@lg:hidden block text-xs text-neutral-500 tabular-nums">
                        {format(at, "HH:mm")} · {dropInLabel(attendance) ?? serial ?? "未扣卡"}
                      </span>
                    </span>
                    <span className="hidden @lg:block min-w-0 truncate text-xs">
                      {attendance.dropIn ? (
                        <span className={attendance.dropIn.isPaid ? "text-neutral-700" : "font-semibold text-warning-950"}>
                          {dropInLabel(attendance)}
                        </span>
                      ) : attendance.studentCard ? (
                        <>
                          {attendance.studentCard.name}{" "}
                          <span className="text-neutral-500 tabular-nums">{serial}</span>
                          {attendance.sessionsUsed > 1 && (
                            <span className="text-neutral-500"> · 扣 {attendance.sessionsUsed} 堂</span>
                          )}
                        </>
                      ) : (
                        <span className="text-neutral-500">未扣卡</span>
                      )}
                    </span>
                    <SourcePill attendance={attendance} />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="w-full py-2.5 text-sm font-semibold text-primary-900 hover:bg-neutral-50 cursor-pointer border-t border-neutral-100"
          >
            載入更早的紀錄（{hiddenCount} 筆）
          </button>
        )}
      </div>
    </div>
  );
};

export default AttendanceByDate;

/** 付單堂的那一筆：「單堂 $900」，沒付加「未付」。 */
function dropInLabel(attendance: StudentAttendance) {
  if (!attendance.dropIn) return null;
  return `單堂 $${formatMoney(attendance.dropIn.amount)}${attendance.dropIn.isPaid ? "" : " 未付"}`;
}
