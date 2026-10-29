import { useState } from "react";
import StudentInfo from "@/components/StudentInfo";
import SegmentedTabs from "@/components/SegmentedTabs";
import BuyAndUseForm from "./BuyAndUseForm";
import { AttendanceRecord, Lesson } from "@/store/slices/lessons";
import { MdOutlineWarning } from "react-icons/md";
import ChooseCardForm from "./ChooseCardForm";
import UseNowButton from "./UseNowButton";
import { DropInForm } from "./DropInForm";
import { formatMoney } from "@/lib/money";
import { DEFAULT_DANCE_LEVEL, danceLevelLabel } from "@/lib/danceLevels";

const UNCHECK_DESCRIPTION_MAP = {
  no_card: "無課卡",
  no_practice_card: "無複習課卡",
  multiple_cards: "多張課卡",
  not_checked: "課卡未消耗",
  not_qualified: "未具備複習卡資格",
};
/**
 * 一筆沒綁卡的出席該怎麼補：沒卡 → 買卡並使用；多張 → 選一張；只差扣卡 → 現在使用。
 * 課程開放單堂付費時，旁邊再多一個「單堂 $X」。
 */
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
  const [inlineMode, setInlineMode] = useState<"card" | "dropIn">("card");
  const props = { record, lesson, studentId: record.studentId, periodId, inline, onDone };
  const cardAction = ["no_card", "no_practice_card", "not_qualified"].includes(record.uncheckedType) ? (
    <BuyAndUseForm {...props} />
  ) : record.uncheckedType === "multiple_cards" ? (
    <ChooseCardForm {...props} />
  ) : (
    <UseNowButton lesson={lesson} studentId={record.studentId} periodId={periodId} onDone={onDone} />
  );
  // inline（已在對話框裡）一次只攤開一張表單：沒卡的人多一個「買卡／單堂」切換。
  if (lesson.dropInPrice === null || (inline && record.uncheckedType !== "no_card")) return cardAction;
  if (inline) {
    return (
      <div className="flex w-full flex-col gap-4">
        <SegmentedTabs
          ariaLabel="補卡方式"
          fill
          value={inlineMode}
          onChange={setInlineMode}
          options={[
            { value: "card", label: "買卡並使用" },
            { value: "dropIn", label: `單堂 $${formatMoney(lesson.dropInPrice)}` },
          ]}
        />
        {inlineMode === "card" ? (
          cardAction
        ) : (
          <DropInForm record={record} lesson={lesson} periodId={periodId} inline onDone={onDone} />
        )}
      </div>
    );
  }
  return (
    <>
      {cardAction}
      <DropInForm record={record} lesson={lesson} periodId={periodId} onDone={onDone} />
    </>
  );
};

export const uncheckedDescription = (record: AttendanceRecord, lesson: Lesson) =>
  record.uncheckedType === "no_card" && record.sessionsUsed > 1
    ? `沒有夠扣 ${record.sessionsUsed} 格的課卡`
    : record.uncheckedType === "not_qualified" && lesson.danceStyle?.hasLevels && lesson.level > DEFAULT_DANCE_LEVEL
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
            {/* 手機：名字＋原因一行、按鈕換到下一行，原因才不會被擠成直排 */}
            <div className="flex min-w-0 basis-full items-center gap-2 lg:basis-auto lg:flex-1">
              <StudentInfo
                studentId={record.studentId}
                avatarUrl={record.studentAvatarUrl}
                name={record.studentName}
                size="small"
                className="shrink-0"
              />
              <p className="min-w-0 truncate text-xs font-medium text-danger-700">
                {uncheckedDescription(record, lesson)}
              </p>
            </div>
            <PendingRecordAction record={record} lesson={lesson} periodId={periodId} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingStudents;
