import {
  Lesson,
  Period,
  useResetAttendanceMutation,
} from "@/store/slices/lessons";
import AddPeriodForm from "./AddPeriodForm";
import EditPeriodTimeForm from "./EditPeriodTimeForm";
import { differenceInCalendarDays, endOfDay, format, isToday } from "date-fns";
import Menu from "@/components/Menu";
import {
  EllipsisVertical,
  Check,
  Clock,
  Trash,
  Eraser,
  PencilLine,
  CalendarCog,
  AlarmClock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useDeletePeriodMutation } from "@/store/slices/lessons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import StatusTag from "@/components/StatusTag";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** Which period gets the 點名 call. 修改／重置 are offered on every attended period. */
const periodMarkers = (periods: Period[]) => ({
  firstPendingPeriodId: periods.find((period) => !period.attendanceTakenAt)?.id,
});

/** Phone: the full timeline, oldest first. */
const PeriodSection = ({
  lesson,
  periods,
}: {
  lesson: Lesson;
  periods: Period[];
}) => {
  const { firstPendingPeriodId } = periodMarkers(periods);

  return (
    <div className="flex flex-col gap-4 px-5">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-bold text-neutral-900">
          時段 · 共 {periods.length} 堂
        </h3>
        <AddPeriodForm lessonId={lesson.id} periods={periods} />
      </div>
      <div className="flex flex-col">
        {periods.map((period, index) => (
          <PeriodRow
            key={period.id}
            period={period}
            canCheck={period.id === firstPendingPeriodId}
            isLastRow={index === periods.length - 1}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Desktop: one dense line per period, grouped by month, newest month on top.
 * The column has a fixed height and scrolls on its own, so an ongoing class
 * with twenty-odd periods never pushes anything off the page.
 */
export const PeriodColumn = ({
  lesson,
  periods,
  headcounts,
  activePeriodId,
  onViewRecord,
  className = "",
}: {
  lesson: Lesson;
  periods: Period[];
  /** Attended count per period id (taken periods only). */
  headcounts: Map<number, number>;
  /** The period whose record is open in the side sheet. */
  activePeriodId?: number | null;
  /** Open a taken period's record in place instead of navigating to its page. */
  onViewRecord?: (periodId: number) => void;
  className?: string;
}) => {
  const { firstPendingPeriodId } = periodMarkers(periods);

  const months: { key: string; label: string; periods: Period[] }[] = [];
  for (const period of [...periods].reverse()) {
    const start = new Date(period.startTime);
    const key = format(start, "yyyy-MM");
    let month = months.at(-1);
    if (!month || month.key !== key) {
      const sameYear = start.getFullYear() === new Date().getFullYear();
      month = { key, label: sameYear ? `${start.getMonth() + 1} 月` : format(start, "yyyy 年 M 月"), periods: [] };
      months.push(month);
    }
    month.periods.push(period);
  }

  return (
    <section
      aria-labelledby="period-column-title"
      className={`flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white ${className}`}
    >
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <h2 id="period-column-title" className="text-[15px] font-bold text-neutral-900">
          時段 <span className="font-medium text-neutral-500">{periods.length} 堂</span>
        </h2>
        <AddPeriodForm lessonId={lesson.id} periods={periods} />
      </div>
      {periods.length === 0 ? (
        <p className="px-4 py-6 text-sm text-neutral-500">還沒有排任何時段</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
          {months.map((month) => {
            const counts = month.periods
              .map((p) => headcounts.get(p.id))
              .filter((n): n is number => n !== undefined);
            const average =
              counts.length > 0 ? (counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1) : null;
            return (
              <div key={month.key}>
                <div className="sticky top-0 z-[1] flex items-baseline justify-between bg-white px-1.5 pt-3.5 pb-1.5">
                  <span className="text-[13px] font-bold text-neutral-900">{month.label}</span>
                  <span className="text-xs text-neutral-500">
                    {month.periods.length} 堂{average && ` · 平均 ${average} 人`}
                  </span>
                </div>
                <ol>
                  {month.periods.map((period) => (
                    <DensePeriodRow
                      key={period.id}
                      period={period}
                      attended={headcounts.get(period.id)}
                      canCheck={period.id === firstPendingPeriodId}
                      active={period.id === activePeriodId}
                      onViewRecord={onViewRecord}
                    />
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

/** Everything a period row can do — shared by the phone timeline and the desktop column. */
const usePeriodActions = (period: Period, onViewRecord?: (periodId: number) => void) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editTimeOpen, setEditTimeOpen] = useState(false);
  const router = useRouter();
  const startTime = new Date(period.startTime);
  const attended = Boolean(period.attendanceTakenAt);
  const [deletePeriod] = useDeletePeriodMutation();
  const [resetAttendance] = useResetAttendanceMutation();

  const handleCheck = () => {
    if (new Date() < startTime) {
      const confirmed = confirm("這個時段還沒開始，確定要點名嗎？");
      if (!confirmed) {
        return;
      }
    }
    router.push(`/lessons/${period.lessonId}/periods/${period.id}/check`);
  };

  const handleDelete = () => {
    setMenuOpen(false);
    const confirmed = confirm("確定要刪除這個時段嗎？");
    if (confirmed) {
      deletePeriod({ id: period.lessonId, periodId: period.id });
    }
  };

  const handleViewAttendance = () => {
    if (onViewRecord) {
      onViewRecord(period.id);
      return;
    }
    router.push(
      `/lessons/${period.lessonId}/periods/${period.id}/check-success`
    );
  };

  const handleReset = () => {
    const confirmed = confirm("確定要重置這個時段的點名嗎？");
    if (confirmed) {
      resetAttendance({ id: period.lessonId, periodId: period.id });
      toast.success("已重置點名紀錄");
    }
    setMenuOpen(false);
  };

  const handleEditTime = () => {
    setMenuOpen(false);
    setEditTimeOpen(true);
  };

  const handleUpdate = () => {
    router.push(`/lessons/${period.lessonId}/periods/${period.id}/check-edit`);
  };

  const menuButton = (className = "") => (
    <Button
      variant="ghost"
      size="iconSm"
      aria-label="時段操作"
      className={`text-neutral-500 ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        setMenuOpen(!menuOpen);
      }}
      ref={buttonRef}
    >
      <EllipsisVertical className="size-4" />
    </Button>
  );

  const overlays = (
    <>
      <Menu
        open={menuOpen}
        anchorEl={buttonRef.current}
        onClose={() => setMenuOpen(false)}
      >
        <div className="flex flex-col gap-1 p-1.5">
          {/* Re-dating stays available after 點名: moving a period keeps its
              records (see the PATCH route), and the mis-dated ones are exactly
              the periods that need moving. */}
          <button
            className="flex gap-2 items-center rounded-lg px-2.5 py-2 text-sm text-neutral-700 hover:bg-neutral-100 cursor-pointer"
            onClick={handleEditTime}
          >
            <CalendarCog className="w-4 h-4" />
            修改時間
          </button>
          {!attended && (
            <button
              className="flex gap-2 items-center rounded-lg px-2.5 py-2 text-sm text-neutral-700 hover:bg-neutral-100 cursor-pointer"
              onClick={handleDelete}
            >
              <Trash className="w-4 h-4" />
              刪除
            </button>
          )}
          {attended && (
            <>
              <button
                className="flex gap-2 items-center rounded-lg px-2.5 py-2 text-sm text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                onClick={handleUpdate}
              >
                <PencilLine className="w-4 h-4" />
                修改
              </button>
              <button
                className="flex gap-2 items-center rounded-lg px-2.5 py-2 text-sm text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                onClick={handleReset}
              >
                <Eraser className="w-4 h-4" />
                重置
              </button>
            </>
          )}
        </div>
      </Menu>

      {editTimeOpen && (
        <EditPeriodTimeForm
          period={period}
          open={editTimeOpen}
          onClose={() => setEditTimeOpen(false)}
        />
      )}
    </>
  );

  return { menuOpen, handleCheck, handleViewAttendance, menuButton, overlays };
};

const DensePeriodRow = ({
  period,
  attended: attendedCount,
  canCheck,
  active = false,
  onViewRecord,
}: {
  period: Period;
  attended: number | undefined;
  canCheck: boolean;
  active?: boolean;
  onViewRecord?: (periodId: number) => void;
}) => {
  const { menuOpen, handleCheck, handleViewAttendance, menuButton, overlays } =
    usePeriodActions(period, onViewRecord);
  const startTime = new Date(period.startTime);
  const attended = Boolean(period.attendanceTakenAt);
  const today = isToday(startTime);
  const isDue = startTime.getTime() <= endOfDay(new Date()).getTime();
  const overdue = !attended && isDue;
  const onRowClick = attended ? handleViewAttendance : canCheck ? handleCheck : undefined;

  return (
    <li
      className={`group flex h-11 items-center gap-2.5 rounded-lg px-1.5 ${
        active ? "bg-primary-50" : today && !attended ? "bg-warning-50" : ""
      } ${onRowClick ? "cursor-pointer hover:bg-neutral-50" : ""}`}
      onClick={onRowClick}
    >
      <span
        aria-hidden="true"
        className={`size-2.5 shrink-0 rounded-full ${
          attended
            ? "bg-primary-700"
            : overdue
              ? "border-2 border-warning-500"
              : "border-[1.5px] border-neutral-300"
        }`}
      />
      <span className="w-[82px] shrink-0 text-sm font-semibold tabular-nums text-neutral-900">
        {format(startTime, "MM/dd")}（{WEEKDAYS[startTime.getDay()]}）
      </span>
      <span className="min-w-0 flex-1 whitespace-nowrap text-xs tabular-nums text-neutral-500">
        {format(startTime, "HH:mm")}–{format(new Date(period.endTime), "HH:mm")}
      </span>
      {attended ? (
        <span className="text-[13px] tabular-nums text-neutral-600">{attendedCount ?? 0} 人</span>
      ) : canCheck && isDue ? (
        <Button
          size="sm"
          className="h-8 px-3"
          onClick={(e) => {
            e.stopPropagation();
            handleCheck();
          }}
        >
          點名
        </Button>
      ) : overdue ? (
        <span className="text-[13px] font-semibold text-warning-900">未點名</span>
      ) : canCheck ? (
        <span className="text-[13px] text-neutral-600">下一堂</span>
      ) : (
        <span className="text-[13px] text-neutral-400">未來</span>
      )}
      {menuButton(
        `size-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 ${menuOpen ? "opacity-100" : ""}`
      )}
      {/* The menu and the time dialog render in portals, whose React events
          still bubble here — keep them from triggering the row click. */}
      <span className="contents" onClick={(e) => e.stopPropagation()}>
        {overlays}
      </span>
    </li>
  );
};

// A past→today→future timeline: a rail dot + connecting line on the left,
// date/time/status on the right. Replaces the old identical bordered-box
// list where every action lived behind one dropdown menu.
const PeriodRow = ({
  period,
  canCheck = false,
  isLastRow = false,
}: {
  period: Period;
  canCheck?: boolean;
  isLastRow?: boolean;
}) => {
  const { handleCheck, handleViewAttendance, menuButton, overlays } =
    usePeriodActions(period);
  const startTime = new Date(period.startTime);
  const endTime = new Date(period.endTime);
  const attended = Boolean(period.attendanceTakenAt);
  // The orange 點名 call is for a class that has happened (or is today). A
  // future first-pending period is just "the next one" — still checkable early
  // (with the confirm below), but not shouted about.
  const isDue = startTime.getTime() <= endOfDay(new Date()).getTime();
  const daysUntil = differenceInCalendarDays(startTime, new Date());
  const date = format(startTime, "MM/dd");
  const weekday = WEEKDAYS[startTime.getDay()];
  const startHour = format(startTime, "HH:mm");
  const endHour = format(endTime, "HH:mm");

  return (
    <div className="flex gap-3">
      {/* Rail: status dot + connecting line down to the next row */}
      <div className="flex flex-col items-center w-5 shrink-0">
        {attended ? (
          <div className="w-5 h-5 rounded-full bg-primary-700 flex items-center justify-center shrink-0">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        ) : canCheck ? (
          <div
            className={`w-5 h-5 rounded-full bg-white border-2 shrink-0 ${
              isDue ? "border-warning-500" : "border-neutral-700"
            }`}
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-white border-2 border-neutral-300 shrink-0" />
        )}
        {!isLastRow && <div className="w-0.5 flex-1 bg-neutral-200" />}
      </div>

      <div className={`flex-1 min-w-0 ${isLastRow ? "" : "pb-3.5"}`}>
        <div
          className={`flex items-center justify-between gap-2 ${
            attended ? "cursor-pointer" : ""
          }`}
          onClick={attended ? handleViewAttendance : undefined}
        >
          <div>
            <div className="text-sm font-semibold">
              {date}（{weekday}）
              {isToday(startTime) && !attended && (
                <span className="text-warning-900 font-bold"> · 今天</span>
              )}
            </div>
            <div className="text-xs text-neutral-500">
              {startHour}–{endHour}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {attended ? (
              <span className="text-xs font-semibold text-primary-700">
                已點名
              </span>
            ) : canCheck && isDue ? (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCheck();
                }}
              >
                <AlarmClock />
                點名
              </Button>
            ) : canCheck ? (
              <>
                <StatusTag tone="neutral">
                  下一堂 · {daysUntil === 1 ? "明天" : `${daysUntil} 天後`}
                </StatusTag>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCheck();
                  }}
                >
                  點名
                </Button>
              </>
            ) : (
              <span className="flex items-center gap-1 text-xs text-neutral-500">
                <Clock className="w-3.5 h-3.5" />
                尚未開始
              </span>
            )}
            {/* Every row has a menu now: any period can be mis-dated, including
                ones already checked — that is the Bailamore case. 修改／重置 stay
                limited to the last attended period, 刪除 to unchecked ones. */}
            {menuButton()}
          </div>
        </div>
      </div>

      {overlays}
    </div>
  );
};

export default PeriodSection;
