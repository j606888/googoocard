import { Button } from "@/components/ui/button";
import SubNavbar from "@/features/SubNavbar";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useParams } from "next/navigation";
import StudentSelectList from "./StudentSelectList";
import Searchbar from "./Searchbar";
import SelectedStudents from "./SelectedStudents";
import PeriodInfo from "./PeriodInfo";
import PeriodAttendanceSkeleton from "./PeriodAttendanceSkeleton";
import { useAttendanceFlow } from "@/hooks/useAttendanceFlow";
import { useSizeClass } from "@/hooks/useMediaQuery";

type PeriodAttendanceFormProps = {
  defaultSelectedIds?: number[];
  selfCheckInStudentIds?: number[];
  /** 在課程頁體驗名單上登記、還沒上過的人——預設勾好並標「體驗報名」。 */
  trialStudentIds?: number[];
  onSubmit: (studentIds: number[]) => Promise<void>;
  submitLabel?: string;
  error?: string | null;
  isLoading?: boolean;
  /** 既有點名紀錄（預設勾選用）還在載入；載完前顯示骨架，勾選才不會晚一拍跳出來。 */
  isRecordsLoading?: boolean;
};

const PeriodAttendanceForm = ({
  defaultSelectedIds = [],
  selfCheckInStudentIds = [],
  trialStudentIds = [],
  onSubmit,
  submitLabel = "完成點名",
  error,
  isLoading,
  isRecordsLoading = false,
}: PeriodAttendanceFormProps) => {
  const { id, periodId } = useParams();
  const isExpanded = useSizeClass() === "expanded";
  const {
    period,
    isLoading: isFlowLoading,
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

  const desktopHeader = (
    <div className="flex items-center gap-3 px-8 pt-6 pb-4">
      <Link
        href={`/lessons/${id}`}
        className="text-neutral-400 hover:text-neutral-600 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
      </Link>
      <h1 className="text-xl font-bold text-neutral-900">點名</h1>
    </div>
  );

  if (isFlowLoading || isRecordsLoading || !period) {
    return (
      <>
        {isExpanded ? (
          desktopHeader
        ) : (
          <SubNavbar title={"點名"} backUrl={`/lessons/${id}`} />
        )}
        <PeriodAttendanceSkeleton variant={isExpanded ? "expanded" : "compact"} />
      </>
    );
  }

  const searchbar = (
    <Searchbar
      error={error || null}
      onSearch={search}
      selectedStudents={selectedStudents}
      onCreateStudent={addStudent}
    />
  );

  const roster = (
    <StudentSelectList
      students={filteredStudents}
      attendStudentIds={attendStudentIds}
      selectedStudents={selectedStudents}
      selfCheckInStudentIds={selfCheckInStudentIds}
      trialStudentIds={trialStudentIds}
      setSelectedStudents={(students) => {
        setSelectedIds(students.map((student) => student.id));
      }}
    />
  );

  const selected = (
    <SelectedStudents
      selectedStudents={selectedStudents}
      onRemoveStudent={removeStudent}
      selfCheckInStudentIds={selfCheckInStudentIds}
      trialStudentIds={trialStudentIds}
    />
  );

  const submitButton = (
    <Button
      onClick={() => onSubmit(selectedIds)}
      disabled={selectedStudents.length === 0}
      isLoading={isLoading}
      size="lg"
      className="w-full"
    >
      {submitLabel}
      {selectedStudents.length > 0 && `（${selectedStudents.length} 人）`}
    </Button>
  );

  // 桌面：左邊勾名單、右邊看已選並送出。側邊欄已經是導航，所以不出
  // 手機的綠色 app-bar；送出按鈕跟著已選清單黏在右欄，不必捲到底。
  if (isExpanded) {
    return (
      <>
        {desktopHeader}
        <div className="px-8 pb-8 grid grid-cols-[minmax(0,1fr)_360px] gap-8 items-start">
          <div className="flex flex-col gap-4 min-w-0">
            <PeriodInfo period={period} />
            {searchbar}
            {roster}
          </div>
          <div className="flex flex-col gap-4 sticky top-6">
            {selected}
            {submitButton}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SubNavbar title={"點名"} backUrl={`/lessons/${id}`} />
      <div className="px-5 pt-5 pb-40 flex flex-col gap-5">
        <div>
          <PeriodInfo period={period} />
        </div>
        <div className="flex flex-col gap-4">
          {searchbar}
          {selected}
          <div className="flex flex-col gap-4 pb-4 ">{roster}</div>
        </div>
        {/* Lifted above the mobile BottomNav (floating pill, fixed bottom-0
            z-40) so the button stays tappable. In the iOS App that nav is
            hidden (the tabs are native), so `flush-bottom` drops it to 0. */}
        <div data-in-app="flush-bottom" className="fixed left-0 right-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] bg-white/90 backdrop-blur-md border-t border-neutral-100 flex gap-4 px-5 py-4 z-30">
          {submitButton}
        </div>
      </div>
    </>
  );
};

export default PeriodAttendanceForm;
