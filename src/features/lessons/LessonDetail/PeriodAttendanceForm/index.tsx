import { useState } from "react";
import { Button } from "@/components/ui/button";
import SubNavbar from "@/features/SubNavbar";
import Drawer from "@/components/Drawer";
import Link from "next/link";
import { ArrowLeft, ChevronUp } from "lucide-react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import StudentSelectList from "./StudentSelectList";
import Searchbar from "./Searchbar";
import CreateStudent from "./CreateStudent";
import AttendanceReview from "./AttendanceReview";
import PeriodInfo from "./PeriodInfo";
import PeriodAttendanceSkeleton from "./PeriodAttendanceSkeleton";
import PeriodAssistantsField from "./PeriodAssistantsField";
import { useAttendanceFlow } from "@/hooks/useAttendanceFlow";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { useGetPeriodAssistantsQuery } from "@/store/slices/lessons";

const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];

type PeriodAttendanceFormProps = {
  defaultSelectedIds?: number[];
  selfCheckInStudentIds?: number[];
  /** 在課程頁體驗名單上登記、還沒上過的人——預設勾好並標「體驗報名」。 */
  trialStudentIds?: number[];
  /** assistantTeacherIds：「今天的助教」整組（含同一天上一堂帶過來、沒改過的建議）。 */
  onSubmit: (studentIds: number[], assistantTeacherIds: number[]) => Promise<void>;
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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const {
    period,
    lesson,
    isLoading: isFlowLoading,
    attendStudentIds,
    lessonTeacherIds,
    selectedStudents,
    selectedIds,
    rosterStudents,
    otherStudents,
    allRosterStudents,
    rowTags,
    keyword,
    search,
    addStudent,
    removeStudent,
    toggleStudent,
    setMany,
  } = useAttendanceFlow({
    lessonId: id as string,
    periodId: Number(periodId),
    defaultSelectedIds,
  });
  const { data: savedAssistants, isLoading: isAssistantsLoading } = useGetPeriodAssistantsQuery({
    id: Number(id),
    periodId: Number(periodId),
  });
  // null ＝ 還沒動過，照伺服器給的（存過的，或同一天上一堂帶過來的建議）。
  const [pickedAssistantIds, setAssistantIds] = useState<number[] | null>(null);
  const assistantIds =
    pickedAssistantIds ?? savedAssistants?.assistants.map((teacher) => teacher.id) ?? [];

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

  if (isFlowLoading || isRecordsLoading || isAssistantsLoading || !period) {
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

  const count = selectedStudents.length;
  const selected = new Set(selectedIds);
  const missingRosterStudents = allRosterStudents.filter((student) => !selected.has(student.id));
  const start = new Date(period.startTime);
  const reviewSubtitle = [
    lesson?.name,
    `${format(start, "M/d")}（${WEEKDAY[start.getDay()]}）${format(start, "HH:mm")}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const submit = () => onSubmit(selectedIds, assistantIds);

  const assistants = (
    <PeriodAssistantsField
      value={assistantIds}
      onChange={setAssistantIds}
      lessonTeacherIds={lessonTeacherIds}
    />
  );

  const searchbar = (
    <Searchbar
      value={keyword}
      error={error || null}
      onSearch={search}
      onCreateClick={() => setIsCreateOpen(true)}
    />
  );

  const list = (
    <StudentSelectList
      rosterStudents={rosterStudents}
      otherStudents={otherStudents}
      selectedIds={selectedIds}
      keyword={keyword}
      rowTags={rowTags}
      selfCheckInStudentIds={selfCheckInStudentIds}
      trialStudentIds={trialStudentIds}
      onToggle={toggleStudent}
      onSetMany={setMany}
      onCreateClick={() => setIsCreateOpen(true)}
    />
  );

  const review = (
    <AttendanceReview
      selectedStudents={selectedStudents}
      missingRosterStudents={missingRosterStudents}
      rosterIds={attendStudentIds}
      onAdd={addStudent}
      onRemove={removeStudent}
    />
  );

  const createStudent = (
    <CreateStudent
      open={isCreateOpen}
      onClose={() => setIsCreateOpen(false)}
      defaultName={keyword}
      onCreate={(student) => {
        addStudent(student.id);
        search("");
      }}
    />
  );

  // 桌面：左邊勾名單、右邊就是送出前的對照（沒勾的、勾了的）＋送出。
  // 側邊欄已經是導航，所以不出手機的綠色 app-bar；右欄 sticky，不必捲到底。
  if (isExpanded) {
    return (
      <>
        {desktopHeader}
        <div className="px-8 pb-8 grid grid-cols-[minmax(0,1fr)_360px] gap-8 items-start">
          <div className="flex flex-col gap-4 min-w-0">
            <PeriodInfo period={period} />
            {assistants}
            {searchbar}
            {list}
          </div>
          <div className="flex flex-col gap-4 sticky top-6">
            {review}
            <Button
              onClick={submit}
              disabled={count === 0}
              isLoading={isLoading}
              size="lg"
              className="w-full"
            >
              {submitLabel}
              {count > 0 && `（${count} 人）`}
            </Button>
          </div>
        </div>
        {createStudent}
      </>
    );
  }

  return (
    <>
      <SubNavbar title={"點名"} backUrl={`/lessons/${id}`} />
      <div className="px-5 pt-4 pb-32 flex flex-col gap-3">
        <PeriodInfo period={period} />
        {assistants}
        {searchbar}
        {list}
      </div>
      {/* 點名頁不掛 BottomNav（見 BottomNav.tsx），動作列直接貼底、留安全區。 */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2.5 border-t border-neutral-200 bg-white px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          variant="secondary"
          size="lg"
          className="px-3.5 text-[15px]"
          aria-haspopup="dialog"
          onClick={() => setIsReviewOpen(true)}
        >
          已勾 {count} 人
          <ChevronUp className="size-4" aria-hidden="true" />
        </Button>
        <Button
          onClick={submit}
          disabled={count === 0}
          isLoading={isLoading}
          size="lg"
          className="flex-1"
        >
          {submitLabel}
        </Button>
      </div>
      <Drawer
        open={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        title={`已勾 ${count} 人`}
        subtitle={reviewSubtitle}
        secondaryText="繼續勾"
        submitText={`${submitLabel}（${count} 人）`}
        disabled={count === 0}
        isLoading={isLoading}
        onSubmit={submit}
      >
        <div className="pb-4">{review}</div>
      </Drawer>
      {createStudent}
    </>
  );
};

export default PeriodAttendanceForm;
