import { Student } from "@/store/slices/students";
import RoundCheckbox from "@/components/RoundCheckbox";
import Image from "next/image";
import { Info } from "lucide-react";
import StatusTag from "@/components/StatusTag";
import type { RowTag } from "@/hooks/attendanceFlow";
import { cn } from "@/lib/utils";

/**
 * 點名名單的一列。列尾最多一個狀態標籤（`attendanceRowTag`：沒卡／資格不符 →
 * 未付 → 剩 1 堂），卡況正常的學生什麼都不標。
 */
const StudentOption = ({
  student,
  isChecked,
  onClick,
  isFirstTime = false,
  isSelfCheckIn = false,
  isTrial = false,
  tag,
}: {
  student: Student;
  isChecked: boolean;
  isFirstTime?: boolean;
  isSelfCheckIn?: boolean;
  isTrial?: boolean;
  tag?: RowTag;
  onClick: (student: Student) => void;
}) => {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isChecked}
      aria-label={`${student.name} 出席${tag ? `（${tag.label}）` : ""}`}
      className={cn(
        "w-full text-left flex flex-col gap-1 min-h-[52px] justify-center px-3 py-2 rounded-xl border-[1.5px] transition-colors cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-primary-300",
        isChecked
          ? "bg-primary-50 border-primary-300"
          : "bg-white border-transparent hover:bg-neutral-50"
      )}
      onClick={() => onClick(student)}
    >
      <div className="flex w-full items-center gap-3">
        <Image
          className="rounded-full object-cover shrink-0"
          width={32}
          height={32}
          src={student.avatarUrl}
          alt=""
        />
        <div className="flex flex-1 items-center gap-1.5 min-w-0">
          <span className="text-[15px] font-semibold text-neutral-900 shrink-0 max-w-full truncate">
            {student.name}
          </span>
          {isSelfCheckIn && <StatusTag tone="outline">自助簽到</StatusTag>}
          {isTrial && <StatusTag tone="outline">體驗報名</StatusTag>}
          {student.isNewStudent && <StatusTag tone="positive">新學員</StatusTag>}
          {student.note && (
            <span className="text-sm text-neutral-500 truncate">({student.note})</span>
          )}
        </div>
        {tag && <StatusTag tone={tag.tone}>{tag.label}</StatusTag>}
        <RoundCheckbox isChecked={isChecked} className="shrink-0" />
      </div>
      {isFirstTime && (
        <div className="flex items-center gap-1 pl-11">
          <Info className="size-3.5 text-primary-700" aria-hidden="true" />
          <span className="text-xs font-medium text-primary-700">第一次上這門課</span>
        </div>
      )}
    </button>
  );
};

export default StudentOption;
