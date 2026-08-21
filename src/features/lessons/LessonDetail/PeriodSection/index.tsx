import {
  Lesson,
  Period,
  useResetAttendanceMutation,
} from "@/store/slices/lessons";
import AddPeriodForm from "./AddPeriodForm";
import { format, isToday } from "date-fns";
import Menu from "@/components/Menu";
import {
  EllipsisVertical,
  Check,
  Clock,
  Trash,
  Eraser,
  PencilLine,
  AlarmClock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useDeletePeriodMutation } from "@/store/slices/lessons";
import { toast } from "sonner";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const PeriodSection = ({
  lesson,
  periods,
}: {
  lesson: Lesson;
  periods: Period[];
}) => {
  const firstPendingPeriodId = periods.find(
    (period) => !period.attendanceTakenAt
  )?.id;
  const lastAttendPeriodId = periods
    .filter((period) => period.attendanceTakenAt)
    .at(-1)?.id;

  return (
    <div className="flex flex-col gap-4 px-5">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-medium">
          Total {periods.length} periods
        </h3>
        <AddPeriodForm lessonId={lesson.id} periods={periods} />
      </div>
      <div className="flex flex-col">
        {periods.map((period, index) => (
          <PeriodRow
            key={period.id}
            period={period}
            canCheck={period.id === firstPendingPeriodId}
            isLastAttend={period.id === lastAttendPeriodId}
            isLastRow={index === periods.length - 1}
          />
        ))}
      </div>
    </div>
  );
};

// A past→today→future timeline: a rail dot + connecting line on the left,
// date/time/status on the right. Replaces the old identical bordered-box
// list where every action lived behind one dropdown menu.
const PeriodRow = ({
  period,
  canCheck = false,
  isLastAttend = false,
  isLastRow = false,
}: {
  period: Period;
  canCheck?: boolean;
  isLastAttend?: boolean;
  isLastRow?: boolean;
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const startTime = new Date(period.startTime);
  const endTime = new Date(period.endTime);
  const attended = Boolean(period.attendanceTakenAt);
  const date = format(startTime, "M/d");
  const weekday = WEEKDAYS[startTime.getDay()];
  const startHour = format(startTime, "HH:mm");
  const endHour = format(endTime, "HH:mm");
  const [deletePeriod] = useDeletePeriodMutation();
  const [resetAttendance] = useResetAttendanceMutation();

  // Taken-but-not-the-last-attended period has nothing left to do (viewing
  // its record is the row's own click target below) — no menu at all then.
  const showMenu = !attended || isLastAttend;

  const handleCheck = () => {
    if (new Date() < new Date(startTime)) {
      const confirmed = confirm("Are you sure you want to check this period?");
      if (!confirmed) {
        return;
      }
    }
    router.push(`/lessons/${period.lessonId}/periods/${period.id}/check`);
  };

  const handleDelete = () => {
    setMenuOpen(false);
    const confirmed = confirm("Are you sure you want to delete this period?");
    if (confirmed) {
      deletePeriod({ id: period.lessonId, periodId: period.id });
    }
  };

  const handleViewAttendance = () => {
    router.push(
      `/lessons/${period.lessonId}/periods/${period.id}/check-success`
    );
  };

  const handleReset = () => {
    const confirmed = confirm("Are you sure you want to reset this period?");
    if (confirmed) {
      resetAttendance({ id: period.lessonId, periodId: period.id });
      toast.success("Reset attendance successfully");
    }
    setMenuOpen(false);
  };

  const handleUpdate = () => {
    router.push(`/lessons/${period.lessonId}/periods/${period.id}/check-edit`);
  };

  return (
    <div className="flex gap-3">
      {/* Rail: status dot + connecting line down to the next row */}
      <div className="flex flex-col items-center w-5 shrink-0">
        {attended ? (
          <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center shrink-0">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        ) : canCheck ? (
          <div className="w-5 h-5 rounded-full bg-white border-2 border-warning-500 shrink-0" />
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
                <span className="text-warning-600 font-bold"> · 今天</span>
              )}
            </div>
            <div className="text-xs text-neutral-400">
              {startHour}–{endHour}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {attended ? (
              <span className="text-xs font-semibold text-primary-600">
                已點名
              </span>
            ) : canCheck ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCheck();
                }}
                className="flex items-center gap-1.5 bg-warning-500 text-white rounded-full px-3.5 py-1.5 text-xs font-bold cursor-pointer hover:bg-warning-600"
              >
                <AlarmClock className="w-3.5 h-3.5" />
                點名
              </button>
            ) : (
              <span className="flex items-center gap-1 text-xs text-neutral-400">
                <Clock className="w-3.5 h-3.5" />
                尚未開始
              </span>
            )}
            {showMenu && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
                ref={buttonRef}
              >
                <EllipsisVertical className="w-4 h-4 text-neutral-300 cursor-pointer hover:text-neutral-500" />
              </button>
            )}
          </div>
        </div>
      </div>

      <Menu
        open={menuOpen}
        anchorEl={buttonRef.current}
        onClose={() => setMenuOpen(false)}
      >
        <div className="flex flex-col gap-3 p-3">
          {!attended && (
            <button
              className="flex gap-2 items-center hover:bg-neutral-100 rounded-sm"
              onClick={handleDelete}
            >
              <Trash className="w-4 h-4" />
              Delete
            </button>
          )}
          {isLastAttend && (
            <>
              <button
                className="flex gap-2 items-center hover:bg-neutral-100 rounded-sm"
                onClick={handleUpdate}
              >
                <PencilLine className="w-4 h-4" />
                Update
              </button>
              <button
                className="flex gap-2 items-center hover:bg-neutral-100 rounded-sm"
                onClick={handleReset}
              >
                <Eraser className="w-4 h-4" />
                Reset
              </button>
            </>
          )}
        </div>
      </Menu>
    </div>
  );
};

export default PeriodSection;
