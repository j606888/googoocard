import { Button } from "@/components/ui/button";
import SubNavbar from "@/features/SubNavbar";
import { useParams } from "next/navigation";
import StudentSelectList from "./StudentSelectList";
import Searchbar from "./Searchbar";
import SelectedStudents from "./SelectedStudents";
import PeriodInfo from "./PeriodInfo";
import { useAttendanceFlow } from "@/hooks/useAttendanceFlow";

type PeriodAttendanceFormProps = {
  defaultSelectedIds?: number[];
  selfCheckInStudentIds?: number[];
  onSubmit: (studentIds: number[]) => Promise<void>;
  submitLabel?: string;
  error?: string | null;
  isLoading?: boolean;
};

const PeriodAttendanceForm = ({
  defaultSelectedIds = [],
  selfCheckInStudentIds = [],
  onSubmit,
  submitLabel = "Take Attendance",
  error,
  isLoading,
}: PeriodAttendanceFormProps) => {
  const { id, periodId } = useParams();
  const {
    period,
    attendStudentIds,
    selectedStudents,
    selectedIds,
    filteredStudents,
    search,
    addStudent,
    removeStudent,
    setSelectedIds,
  } = useAttendanceFlow({
    lessonId: id as string,
    periodId: Number(periodId),
    defaultSelectedIds,
  });

  if (!period) return <div>載入中…</div>;

  return (
    <>
      <SubNavbar title={"點名"} backUrl={`/lessons/${id}`} />
      <div className="px-5 pt-5 pb-40 lg:pb-28 flex flex-col gap-5">
        <div>
          <PeriodInfo period={period} />
        </div>
        <div className="flex flex-col gap-4">
          <Searchbar
            error={error || null}
            onSearch={search}
            selectedStudents={selectedStudents}
            onCreateStudent={addStudent}
          />
          <SelectedStudents
            selectedStudents={selectedStudents}
            onRemoveStudent={removeStudent}
            selfCheckInStudentIds={selfCheckInStudentIds}
          />
          <div className="flex flex-col gap-4 pb-4 ">
            <StudentSelectList
              students={filteredStudents}
              attendStudentIds={attendStudentIds}
              selectedStudents={selectedStudents}
              selfCheckInStudentIds={selfCheckInStudentIds}
              setSelectedStudents={(students) => {
                setSelectedIds(students.map((student) => student.id));
              }}
            />
          </div>
        </div>
        {/* Lifted above the mobile BottomNav (floating pill, fixed bottom-0
            z-40) so the button stays tappable; flush to bottom on the expanded
            layout, where the nav is lg:hidden. Both sides switch at the single
            size-class boundary (--breakpoint-lg), so they stay in step. */}
        <div className="fixed left-0 right-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-0 bg-white/90 backdrop-blur-md border-t border-neutral-100 flex gap-4 px-5 py-4 z-30">
          <Button
            onClick={() => onSubmit(selectedIds)}
            disabled={selectedStudents.length === 0}
            isLoading={isLoading}
            className="w-full rounded-xl shadow-[0_6px_18px_-6px_rgba(43,142,110,0.7)]"
          >
            {submitLabel}
            {selectedStudents.length > 0 && ` (${selectedStudents.length})`}
          </Button>
        </div>
      </div>
    </>
  );
};

export default PeriodAttendanceForm;
