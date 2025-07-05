import { Lesson, Period, useResetAttendanceMutation } from "@/store/slices/lessons";
import AddPeriodForm from "./AddPeriodForm";
import { format } from "date-fns";
import Menu from "@/components/Menu";
import {
  EllipsisVertical,
  PenTool,
  Check,
  NotepadText,
  Trash,
  Eraser,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useDeletePeriodMutation } from "@/store/slices/lessons";
import { toast } from "sonner";

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
        <AddPeriodForm
          lessonId={lesson.id}
          lastPeriod={periods[periods.length - 1]}
        />
      </div>
      <div className="flex flex-col gap-3">
        {periods.map((period) => (
          <PeriodCard
            key={period.id}
            period={period}
            canCheck={period.id === firstPendingPeriodId}
            isLastAttend={period.id === lastAttendPeriodId}
          />
        ))}
      </div>
    </div>
  );
};

const PeriodCard = ({
  period,
  canCheck = false,
  isLastAttend = false,
}: {
  period: Period;
  canCheck?: boolean;
  isLastAttend?: boolean;
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const startTime = new Date(period.startTime);
  const endTime = new Date(period.endTime);
  const date = format(startTime, "yyyy/MM/dd, EEE");
  const startHour = format(startTime, "h:mm a");
  const endHour = format(endTime, "h:mm a");
  const [deletePeriod] = useDeletePeriodMutation();
  const [resetAttendance] = useResetAttendanceMutation();

  const handleCheck = () => {
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
    }
    toast.success("Reset attendance successfully");
    setMenuOpen(false);
  };

  return (
    <div
      key={period.id}
      className="flex flex-col gap-3 p-3 border border-gray-200 rounded-md"
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold flex items-center gap-2">
          {date}
          {period.attendanceTakenAt && (
            <Check className="w-5 h-5 text-primary-500" />
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-sm ">
            <span>{startHour}</span>
            <span>~</span>
            <span>{endHour}</span>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} ref={buttonRef}>
            <EllipsisVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
      {canCheck && (
        <button
          className="flex items-center justify-center gap-2 px-3 py-2 bg-primary-500 text-white rounded-md text-sm cursor-pointer"
          onClick={handleCheck}
        >
          <PenTool className="w-4 h-4" />
          Check
        </button>
      )}
      <Menu
        open={menuOpen}
        anchorEl={buttonRef.current}
        onClose={() => setMenuOpen(false)}
      >
        <div className="flex flex-col gap-3 p-3">
          {period.attendanceTakenAt ? (
            <button
              className="flex gap-2 items-center hover:bg-gray-100 rounded-sm"
              onClick={handleViewAttendance}
            >
              <NotepadText className="w-4 h-4" />
              View Attendance
            </button>
          ) : (
            <button
              className="flex gap-2 items-center hover:bg-gray-100 rounded-sm"
              onClick={handleDelete}
            >
              <Trash className="w-4 h-4" />
              Delete
            </button>
          )}
          {isLastAttend && (
            <button
              className="flex gap-2 items-center hover:bg-gray-100 rounded-sm"
              onClick={handleReset}
            >
              <Eraser className="w-4 h-4" />
              Reset
            </button>
          )}
        </div>
      </Menu>
    </div>
  );
};

export default PeriodSection;
