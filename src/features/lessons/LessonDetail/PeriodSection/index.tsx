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
  Check,
  EllipsisVertical,
  Trash,
  Eraser,
  PencilLine,
  CalendarCog,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useDeletePeriodMutation } from "@/store/slices/lessons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import KiwiMascot from "@/components/KiwiMascot";
import { formatMoney } from "@/lib/money";
import { buildTimeline } from "../termPage";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** Which period gets the 點名 call. 修改／重置 are offered on every attended period. */
const periodMarkers = (periods: Period[]) => ({
  firstPendingPeriodId: periods.find((period) => !period.attendanceTakenAt)?.id,
});

/**
 * Phone: the term as a timeline, oldest first. Taken periods carry the headcount
 * and what the class earned; the first one that still needs 點名 is the loud card
 * in its place; later ones are dimmed. Long lessons fold around that card
 * (`buildTimeline`) so an ongoing class with thirty periods doesn't push it away.
 */
const PeriodSection = ({
  lesson,
  periods,
  headcounts,
  revenues,
}: {
  lesson: Lesson;
  periods: Period[];
  /** Attended count per period id (taken periods only). */
  headcounts: Map<number, number>;
  /** Revenue per period id (taken periods only) — empty while it loads. */
  revenues: Map<number, number>;
}) => {
  const [showEarlier, setShowEarlier] = useState(false);
  const [showLater, setShowLater] = useState(false);
  const timeline = buildTimeline(periods, { showEarlier, showLater, now: new Date() });
  const lastId = lesson.kind === "fixed" && periods.length > 1 ? periods.at(-1)?.id : undefined;

  return (
    <div className="flex flex-col px-5 pt-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-neutral-900">
          時段 <span className="font-medium text-neutral-600">{periods.length} 堂</span>
        </h3>
        <AddPeriodForm lessonId={lesson.id} periods={periods} />
      </div>
      {periods.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <KiwiMascot pose="stand-34" className="w-20" />
          <p className="text-sm text-neutral-600">還沒有排任何時段</p>
        </div>
      ) : (
        <>
          {timeline.earlierHidden > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 self-start px-2 text-primary-900"
              onClick={() => setShowEarlier(true)}
            >
              看更早的 {timeline.earlierHidden} 堂
            </Button>
          )}
          <ol className="mt-1.5 flex flex-col gap-1.5">
            {timeline.rows.map(({ period, number }) =>
              period.id === timeline.focusId ? (
                <FocusPeriodCard key={period.id} period={period} number={number} />
              ) : (
                <PeriodRow
                  key={period.id}
                  period={period}
                  number={number}
                  isLast={period.id === lastId}
                  attended={headcounts.get(period.id)}
                  revenue={revenues.get(period.id)}
                />
              )
            )}
          </ol>
          {timeline.laterHidden > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 self-start px-2 text-primary-900"
              onClick={() => setShowLater(true)}
            >
              之後還有 {timeline.laterHidden} 堂
            </Button>
          )}
        </>
      )}
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
      <span className="w-20 shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-neutral-900">
        {format(startTime, "M/d")}（{WEEKDAYS[startTime.getDay()]}）
      </span>
      <span className="min-w-0 flex-1 whitespace-nowrap text-xs tabular-nums text-neutral-500">
        {format(startTime, "HH:mm")}–{format(new Date(period.endTime), "HH:mm")}
      </span>
      {attended ? (
        <span className="text-[13px] tabular-nums text-neutral-600">{attendedCount ?? 0} 人</span>
      ) : (canCheck || today) && isDue ? (
        // 今天的是「點名」、過期的是「補點名」——兩顆長得一樣就容易點到錯的日期。
        <Button
          size="sm"
          variant={today ? "primary" : "secondary"}
          className="h-8 px-2.5"
          onClick={(e) => {
            e.stopPropagation();
            handleCheck();
          }}
        >
          {today ? "點名" : "補點名"}
        </Button>
      ) : overdue ? (
        <span className="text-[13px] font-semibold text-warning-900">還沒點名</span>
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

// 月日不補零，跟今天頁、點名頁、收款卡片同一種寫法。
const dateLabel = (date: Date) => `${format(date, "M/d")}（${WEEKDAYS[date.getDay()]}）`;
const timeLabel = (period: Period) =>
  `${format(new Date(period.startTime), "HH:mm")}–${format(new Date(period.endTime), "HH:mm")}`;

/**
 * Phone: the one period that can be checked right now. Overdue or today → the
 * loud 點名; a future one is just "下一堂", still checkable early.
 */
const FocusPeriodCard = ({ period, number }: { period: Period; number: number }) => {
  const { handleCheck, menuButton, overlays } = usePeriodActions(period);
  const startTime = new Date(period.startTime);
  const today = isToday(startTime);
  const isDue = startTime.getTime() <= endOfDay(new Date()).getTime();
  const days = differenceInCalendarDays(startTime, new Date());
  const label = today
    ? "今天"
    : isDue
      ? `還沒點名 · ${-days} 天前`
      : `下一堂 · ${days === 1 ? "明天" : `${days} 天後`}`;

  return (
    <li
      aria-label={isDue ? "還沒點名" : "下一堂"}
      className={`my-1 flex items-center gap-2.5 rounded-2xl border-2 py-3 pr-1.5 pl-3 ${
        today
          ? "border-primary-900 bg-white"
          : isDue
            ? "border-warning-300 bg-warning-50"
            : "border-primary-300 bg-primary-50"
      }`}
    >
      {/* 今天要上的在跳舞、忘記點的嚇一跳、還沒到的站著等。 */}
      <KiwiMascot pose={today ? "dance" : isDue ? "surprised" : "stand"} className="w-11 shrink-0" />
      <div className="min-w-0 flex-1">
        <p
          className={`text-xs font-bold ${
            today ? "text-accent-900" : isDue ? "text-warning-950" : "text-primary-900"
          }`}
        >
          {label} · 第 {number} 堂
        </p>
        <p className="mt-0.5 truncate text-[17px] font-bold tabular-nums text-neutral-900">
          {dateLabel(startTime)}
          <span className="ml-1.5 text-sm font-medium text-neutral-700">{format(startTime, "HH:mm")}</span>
        </p>
      </div>
      <Button variant={isDue ? "primary" : "secondary"} onClick={handleCheck}>
        點名
      </Button>
      {menuButton()}
      {overlays}
    </li>
  );
};

/**
 * Phone: one line per period. Taken ones show the headcount and revenue and open
 * the record; the rest say whether they are overdue or how far away they are.
 */
const PeriodRow = ({
  period,
  number,
  isLast,
  attended: attendedCount,
  revenue,
}: {
  period: Period;
  number: number;
  isLast: boolean;
  attended: number | undefined;
  revenue: number | undefined;
}) => {
  const { handleCheck, handleViewAttendance, menuButton, overlays } = usePeriodActions(period);
  const startTime = new Date(period.startTime);
  const attended = Boolean(period.attendanceTakenAt);
  const overdue = !attended && startTime.getTime() <= endOfDay(new Date()).getTime();
  const today = isToday(startTime);
  const days = differenceInCalendarDays(startTime, new Date());

  return (
    <li
      className={`flex min-h-13 items-center gap-2.5 rounded-xl pr-2 pl-3 ${
        attended ? "cursor-pointer bg-neutral-50" : ""
      }`}
      onClick={attended ? handleViewAttendance : undefined}
    >
      <span
        aria-hidden="true"
        className={`grid size-7 shrink-0 place-items-center rounded-full ${
          attended
            ? "bg-primary-100 text-primary-900"
            : overdue
              ? "border-2 border-warning-500"
              : "border-2 border-dashed border-neutral-300"
        }`}
      >
        {attended && <Check className="size-4" strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-1 tabular-nums">
        <p className={`truncate text-[15px] font-semibold ${attended ? "text-neutral-900" : "text-neutral-600"}`}>
          {dateLabel(startTime)}
          <span className="ml-1.5 text-xs font-normal text-neutral-600">
            第 {number} 堂{isLast && " · 最後一堂"}
          </span>
        </p>
        {/* 時間只在跟別堂不一樣時才有用；每堂都印會把一整欄變成重複的噪音，所以收進一行小字。 */}
        <p className="truncate text-xs text-neutral-600">{timeLabel(period)}</p>
      </div>
      {attended ? (
        <span className="flex shrink-0 items-center gap-2.5 text-sm tabular-nums">
          <span className="text-neutral-700">{attendedCount ?? 0} 人</span>
          {revenue !== undefined && (
            <span className="min-w-14 text-right font-bold text-neutral-900">${formatMoney(revenue)}</span>
          )}
        </span>
      ) : overdue ? (
        // 醒目的那張卡只有一張；其他已經到了卻沒點名的時段也要有入口，不然只能從今天頁繞。
        <Button variant={today ? "primary" : "secondary"} size="sm" onClick={handleCheck}>
          {today ? "點名" : "補點名"}
        </Button>
      ) : (
        <span className="shrink-0 text-[13px] text-neutral-600">
          {days <= 0 ? "今天" : days === 1 ? "明天" : `${days} 天後`}
        </span>
      )}
      {/* Every row keeps its menu: any period can be mis-dated, including ones
          already checked — that is the Bailamore case. */}
      {menuButton()}
      <span className="contents" onClick={(e) => e.stopPropagation()}>
        {overlays}
      </span>
    </li>
  );
};

export default PeriodSection;
