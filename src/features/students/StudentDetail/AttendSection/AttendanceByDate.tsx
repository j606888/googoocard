import { useState } from "react";
import { format } from "date-fns";
import type { StudentAttendance } from "@/store/slices/students";
import DanceBadge from "../../StudentList/DanceBadge";
import { formatCardSerial } from "@/lib/cardSerial";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { attendanceSourceLabel, groupByMonth, takeMonthsUntil } from "./attendanceInsights";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 第一次先列到這麼多筆（整月為單位），其餘收在「載入更早的紀錄」後面。 */
const INITIAL_ROWS = 20;

/** 來源寫成字：待老師確認是要處理的事（琥珀），其餘是淡字。 */
const SOURCE_CLASS: Record<"self" | "teacher" | "pending", string> = {
  self: "text-ink-2",
  teacher: "text-ink-3",
  pending: "font-semibold text-warning-800",
};

export const SourcePill = ({ attendance }: { attendance: Pick<StudentAttendance, "source" | "pending"> }) => {
  const { label, tone } = attendanceSourceLabel(attendance);
  return <span className={`justify-self-start text-[13px] ${SOURCE_CLASS[tone]}`}>{label}</span>;
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
      <div className="flex flex-col gap-6">
        {visibleGroups.map((group) => (
          <section key={group.key}>
            <h4 className="m-0 flex items-baseline justify-between pb-1 text-[13px] font-semibold text-ink-2">
              {group.label}
              <span className="font-normal tabular-nums text-ink-3">{group.attendances.length} 堂</span>
            </h4>
            <ul className="m-0 p-0 list-none divide-y divide-line border-y border-line">
              {group.attendances.map((attendance, index) => {
                const at = new Date(attendance.startTime);
                const serial = attendance.studentCard ? formatCardSerial(attendance.studentCard.serialNumber) : null;
                return (
                  <li
                    key={`${attendance.lessonId}-${attendance.startTime}-${index}`}
                    className={`grid min-h-14 grid-cols-[52px_minmax(0,1fr)_auto] ${ROW_COLS} gap-3 items-center py-2 text-[13px] text-ink-2`}
                  >
                    <span className="leading-tight">
                      <span className="block text-[15px] font-medium text-ink tabular-nums">{format(at, "M/d")}</span>
                      <span className="block text-[13px] text-ink-3">
                        週{WEEKDAYS[at.getDay()]}
                        <span className="hidden @lg:inline"> {format(at, "HH:mm")}</span>
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 flex-wrap text-[15px] font-medium text-ink">
                        <span className="truncate">{attendance.lessonName}</span>
                        {attendance.danceStyle && <DanceBadge style={attendance.danceStyle} />}
                      </span>
                      {/* 窄槽位：時間和卡號併到課名下面 */}
                      <span className="@lg:hidden block text-[13px] text-ink-3 tabular-nums">
                        {format(at, "HH:mm")} · {dropInLabel(attendance) ?? serial ?? "未扣卡"}
                      </span>
                    </span>
                    <span className="hidden @lg:block min-w-0 truncate">
                      {attendance.dropIn ? (
                        <span className={attendance.dropIn.isPaid ? "text-ink-2" : "font-semibold text-warning-800"}>
                          {dropInLabel(attendance)}
                        </span>
                      ) : attendance.studentCard ? (
                        <>
                          {attendance.studentCard.name}{" "}
                          <span className="text-ink-3 tabular-nums">{serial}</span>
                          {attendance.sessionsUsed > 1 && (
                            <span className="text-ink-3"> · 扣 {attendance.sessionsUsed} 堂</span>
                          )}
                        </>
                      ) : (
                        <span className="text-ink-3">未扣卡</span>
                      )}
                    </span>
                    <SourcePill attendance={attendance} />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {hiddenCount > 0 && (
        <Button type="button" variant="text" size="sm" className="mt-2 -ml-2" onClick={() => setShowAll(true)}>
          載入更早的紀錄（{hiddenCount} 筆）
        </Button>
      )}
    </div>
  );
};

export default AttendanceByDate;

/** 付單堂的那一筆：「單堂 $900」，沒付加「未付」。 */
function dropInLabel(attendance: StudentAttendance) {
  if (!attendance.dropIn) return null;
  return `單堂 $${formatMoney(attendance.dropIn.amount)}${attendance.dropIn.isPaid ? "" : " 未付"}`;
}
