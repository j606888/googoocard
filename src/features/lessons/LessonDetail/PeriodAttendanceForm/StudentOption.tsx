import type { ReactNode } from "react";
import { Student } from "@/store/slices/students";
import RoundCheckbox from "@/components/RoundCheckbox";
import StudentAvatar from "@/components/StudentAvatar";
import { Info, MessageSquareText } from "lucide-react";
import StatusTag from "@/components/StatusTag";
import type { RowTag } from "@/hooks/attendanceFlow";
import { cn } from "@/lib/utils";

/**
 * 點名名單的一列。名字下面一行是「完成點名會扣哪張卡」（`cardLine`，伺服器算的）；
 * 列尾最多一個狀態標籤（`attendanceRowTag`：沒卡／資格不符 → 未付 → 剩 1 堂），
 * 卡況正常的學生什麼都不標。勾了卻沒卡的人整列換成珊瑚橘，`action` 放「買卡」。
 */
const StudentOption = ({
  student,
  isChecked,
  onClick,
  isFirstTime = false,
  isSelfCheckIn = false,
  studentNote,
  isTrial = false,
  isBooked = false,
  bookingNote,
  tag,
  cardLine,
  action,
}: {
  student: Student;
  isChecked: boolean;
  isFirstTime?: boolean;
  isSelfCheckIn?: boolean;
  /** 學生自助簽到時留的話。 */
  studentNote?: string;
  isTrial?: boolean;
  /** 老師事先登記了「預計會來」這一堂（只是提示，不預設勾選）。 */
  isBooked?: boolean;
  /** 預約時寫的備註（「先試第一堂」）。 */
  bookingNote?: string | null;
  tag?: RowTag;
  /** 「進階6堂 · 扣完剩 3 堂」 */
  cardLine?: string;
  /** 列尾、勾選框左邊的動作（買卡）。跟勾選是兩顆按鈕，不包在一起。 */
  action?: ReactNode;
  onClick: (student: Student) => void;
}) => {
  const needsCard = isChecked && tag?.tone === "warning" && !cardLine;
  return (
    <div
      className={cn(
        "flex min-h-[58px] items-center rounded-xl border-[1.5px] transition-colors",
        needsCard
          ? "bg-accent-50 border-accent-200"
          : isChecked
            ? "bg-primary-50 border-primary-300"
            : "bg-white border-transparent hover:bg-neutral-50"
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={isChecked}
        aria-label={`${student.name} 出席${tag ? `（${tag.label}）` : ""}`}
        className="flex min-w-0 flex-1 cursor-pointer flex-col justify-center gap-1 self-stretch rounded-xl px-3 py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-primary-300"
        onClick={() => onClick(student)}
      >
        <div className="flex w-full items-center gap-3">
          <StudentAvatar
            className="size-9 shrink-0 rounded-full object-cover"
            width={36}
            height={36}
            src={student.avatarUrl}
            alt=""
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="max-w-full shrink-0 truncate text-[15px] font-semibold text-neutral-900">
                {student.name}
              </span>
              {isSelfCheckIn && <StatusTag tone="outline">自助簽到</StatusTag>}
              {student.lineSelfClaimed && <StatusTag tone="warning">自助認領</StatusTag>}
              {isTrial && <StatusTag tone="outline">體驗報名</StatusTag>}
              {isBooked && <StatusTag tone="outline">預計今天會到</StatusTag>}
              {student.isNewStudent && <StatusTag tone="positive">新學員</StatusTag>}
              {student.note && (
                <span className="truncate text-sm text-neutral-500">({student.note})</span>
              )}
            </div>
            {cardLine && <p className="truncate text-xs text-neutral-600">{cardLine}</p>}
            {bookingNote && <p className="truncate text-xs text-neutral-500">預約備註：{bookingNote}</p>}
            {/* 沒卡不擋點名：送出後這個人會進完成頁的「待處理」。先講清楚，老師才敢按完成。 */}
            {needsCard && <p className="truncate text-xs font-medium text-accent-900">沒卡 · 可以先點名再補</p>}
          </div>
          {/* 勾了卻沒卡的列，「沒卡」已經寫在第二行，這裡不再重複一顆標籤擠掉名字。 */}
          {tag && !needsCard && <StatusTag tone={tag.tone}>{tag.label}</StatusTag>}
          {!action && <RoundCheckbox isChecked={isChecked} className="size-7 shrink-0" />}
        </div>
        {studentNote && <StudentNoteLine note={studentNote} />}
        {isFirstTime && (
          <div className="flex items-center gap-1 pl-12">
            <Info className="size-3.5 text-primary-700" aria-hidden="true" />
            <span className="text-xs font-medium text-primary-700">第一次上這門課</span>
          </div>
        )}
      </button>
      {action && (
        <div className="flex shrink-0 items-center gap-2 pr-3">
          {action}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="cursor-pointer"
            onClick={() => onClick(student)}
          >
            <RoundCheckbox isChecked={isChecked} className="size-7" />
          </button>
        </div>
      )}
    </div>
  );
};

export default StudentOption;

/** 學生自助簽到時留給老師的話（點名列、整期列共用）。 */
export function StudentNoteLine({ note }: { note: string }) {
  return (
    <div className="flex items-start gap-1 pl-12">
      <MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-primary-700" aria-hidden="true" />
      <span className="text-xs leading-snug text-neutral-700">「{note}」</span>
    </div>
  );
}
