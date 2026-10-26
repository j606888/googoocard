import StudentInfo from "@/components/StudentInfo";
import BuyAndUseForm from "./BuyAndUseForm";
import { AttendanceRecord, Lesson } from "@/store/slices/lessons";
import { MdOutlineWarning } from "react-icons/md";
import ChooseCardForm from "./ChooseCardForm";
import UseNowButton from "./UseNowButton";
import { DEFAULT_DANCE_LEVEL, danceLevelLabel } from "@/lib/danceLevels";

const UNCHECK_DESCRIPTION_MAP = {
  no_card: "無課卡",
  no_practice_card: "無複習課卡",
  multiple_cards: "多張課卡",
  not_checked: "課卡未消耗",
  not_qualified: "未具備複習卡資格",
};
/** 一筆沒綁卡的出席該怎麼補：沒卡 → 買卡並使用；多張 → 選一張；只差扣卡 → 現在使用。 */
export const PendingRecordAction = ({
  record,
  lesson,
  periodId,
  inline,
  onDone,
}: {
  record: AttendanceRecord;
  lesson: Lesson;
  periodId: number;
  /** 已經在對話框裡（待處理鈴鐺的「補卡」）：表單直接攤開 */
  inline?: boolean;
  onDone?: () => void;
}) => {
  const props = { record, lesson, studentId: record.studentId, periodId, inline, onDone };
  if (["no_card", "no_practice_card", "not_qualified"].includes(record.uncheckedType)) {
    return <BuyAndUseForm {...props} />;
  }
  if (record.uncheckedType === "multiple_cards") {
    return <ChooseCardForm {...props} />;
  }
  return <UseNowButton lesson={lesson} studentId={record.studentId} periodId={periodId} onDone={onDone} />;
};

export const uncheckedDescription = (record: AttendanceRecord, lesson: Lesson) =>
  record.uncheckedType === "not_qualified" && lesson.danceStyle?.hasLevels && lesson.level > DEFAULT_DANCE_LEVEL
    ? `未具備${danceLevelLabel(lesson.level)}複習資格`
    : UNCHECK_DESCRIPTION_MAP[record.uncheckedType];

const PendingStudents = ({
  records,
  lesson,
  periodId,
}: {
  records: AttendanceRecord[];
  lesson: Lesson;
  periodId: number;
}) => {
  return (
    <div className="flex flex-col gap-2 w-full rounded-2xl border border-danger-200 bg-danger-50/60 p-3">
      <div className="flex items-center gap-1.5 text-danger-700">
        <MdOutlineWarning className="w-4 h-4" />
        <p className="text-sm font-semibold">未綁定課卡學生</p>
      </div>
      <div className="flex flex-col gap-1">
        {records.map((record) => (
          <div
            key={record.studentId}
            className="flex flex-wrap items-center gap-2 bg-white rounded-xl px-2.5 py-2 border border-danger-100"
          >
            <StudentInfo
              studentId={record.studentId}
              avatarUrl={record.studentAvatarUrl}
              name={record.studentName}
              size="small"
            />
            <div className="flex flex-1 items-center gap-1 text-danger-700">
              <p className="text-xs font-medium">{uncheckedDescription(record, lesson)}</p>
            </div>
            <PendingRecordAction record={record} lesson={lesson} periodId={periodId} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingStudents;
