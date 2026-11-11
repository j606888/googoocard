"use client";

import Link from "next/link";
import { SquareArrowOutUpRight, X } from "lucide-react";
import StudentDetail from "./StudentDetail";
import StudentDetailHeader from "./StudentDetail/StudentDetailHeader";
import AttentionBar from "./StudentDetail/AttentionBar";
import StudentDetailSkeleton from "./StudentDetail/StudentDetailSkeleton";
import { useGetStudentQuery } from "@/store/slices/students";
import { studentDetailHref } from "@/lib/studentNav";
import { Button, buttonVariants } from "@/components/ui/button";
import SideSheet from "@/components/SideSheet";

const barIcon = `${buttonVariants({ variant: "ghost", size: "iconSm" })} text-neutral-500`;

/**
 * 桌面版的學生詳情抽屜：細頂列（左邊由呼叫端放上一位／下一位之類的導覽，
 * 右邊是「開啟完整頁」與關閉）＋跟獨立學生頁同一套頁首與分頁。
 * 學生頁的名單與課程頁的名單共用這一個。
 */
const StudentSheet = ({
  studentId,
  onClose,
  from,
  leading,
}: {
  studentId: number | null;
  onClose: () => void;
  /** 「開啟完整頁」之後按返回要回到哪裡。 */
  from?: string;
  /** 頂列左側的內容（上一位／下一位）。 */
  leading?: React.ReactNode;
}) => {
  // `currentData`, not `data`: `data` keeps the PREVIOUS student while the next
  // one loads, so the sheet showed the wrong person and a click looked ignored.
  const { currentData: student, isLoading } = useGetStudentQuery(
    { id: studentId as number },
    { skip: studentId == null }
  );

  return (
    <SideSheet
      open={studentId != null}
      onClose={onClose}
      label={student ? student.name : "學生詳情"}
      className="w-[600px]"
    >
      <div className="flex-none flex items-center justify-between h-13 pl-3 pr-2.5 bg-white border-b border-neutral-100">
        <div className="flex items-center gap-0.5">{leading}</div>
        <div className="flex items-center gap-0.5">
          {student && (
            <Link
              href={studentDetailHref(student.id, from)}
              aria-label="開啟完整頁"
              title="開啟完整頁"
              className={barIcon}
            >
              <SquareArrowOutUpRight className="w-[18px] h-[18px]" />
            </Link>
          )}
          <Button
            type="button"
            variant="ghost"
            size="iconSm"
            onClick={onClose}
            aria-label="關閉"
            title="關閉（Esc）"
            className="text-neutral-500"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {isLoading || !student ? (
          <StudentDetailSkeleton variant="pane" />
        ) : (
          <>
            <StudentDetailHeader student={student} variant="pane" />
            <AttentionBar student={student} className="flex-none px-6 pt-3 bg-white" />
            <StudentDetail student={student} variant="pane" />
          </>
        )}
      </div>
    </SideSheet>
  );
};

export default StudentSheet;
