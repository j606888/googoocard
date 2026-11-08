"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, SquareArrowOutUpRight, X } from "lucide-react";
import StudentList from "./StudentList";
import StudentDetail from "./StudentDetail";
import StudentDetailHeader from "./StudentDetail/StudentDetailHeader";
import AttentionBar from "./StudentDetail/AttentionBar";
import { Student, useGetStudentQuery } from "@/store/slices/students";
import { studentDetailHref } from "@/lib/studentNav";
import StudentDetailSkeleton from "./StudentDetail/StudentDetailSkeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import SideSheet from "@/components/SideSheet";
import { useSelectionMirroredToUrl } from "@/components/SplitView";

const selHref = (studentId: number) => `/students?sel=${studentId}`;

const barIcon = `${buttonVariants({ variant: "ghost", size: "iconSm" })} text-neutral-500`;

/**
 * 桌面版學生頁：全寬名單，點一列從右邊滑出學生詳情。
 *
 * 選取鏡射到網址（`?sel=`）的行為沿用 `useSelectionMirroredToUrl`——為什麼
 * state 是真相、網址只是鏡射，理由寫在那裡。關掉抽屜就清掉選取和網址參數。
 *
 * 抽屜最上面一條細頂列：左邊上一位／下一位（跟鍵盤 ↑↓ 同一份名單順序——目前的
 * 篩選＋排序），右上角是「開啟完整頁」與關閉。載入中也在，關閉鈕不會跳位置。
 * 下面是跟獨立學生頁同一套頁首＋分頁；600px 寬時 `StudentDetail` 會自己把
 * 側欄收成「資料」分頁。
 */
const StudentsTableView = () => {
  const { selectedId, select, clear } = useSelectionMirroredToUrl("sel");
  const [visible, setVisible] = useState<Student[]>([]);

  // `currentData`, not `data`: `data` keeps the PREVIOUS student while the next
  // one loads, so the sheet showed the wrong person and a click looked ignored.
  const { currentData: student, isLoading } = useGetStudentQuery(
    { id: selectedId as number },
    { skip: selectedId == null }
  );

  const handleSelect = useCallback((next: Student) => select(next.id), [select]);

  const index = selectedId == null ? -1 : visible.findIndex((s) => s.id === selectedId);
  const prev = index > 0 ? visible[index - 1] : null;
  const next = index >= 0 && index < visible.length - 1 ? visible[index + 1] : null;

  return (
    <>
      <StudentList
        variant="table"
        selectedId={selectedId}
        onSelect={handleSelect}
        onVisibleChange={setVisible}
      />
      <SideSheet
        open={selectedId != null}
        onClose={clear}
        label={student ? student.name : "學生詳情"}
        className="w-[600px]"
      >
        <div className="flex-none flex items-center justify-between h-13 pl-3 pr-2.5 bg-white border-b border-neutral-100">
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="iconSm"
              className="text-neutral-500"
              aria-label="上一位學生"
              title="上一位（↑）"
              disabled={!prev}
              onClick={() => prev && select(prev.id)}
            >
              <ChevronUp className="w-5 h-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="iconSm"
              className="text-neutral-500"
              aria-label="下一位學生"
              title="下一位（↓）"
              disabled={!next}
              onClick={() => next && select(next.id)}
            >
              <ChevronDown className="w-5 h-5" />
            </Button>
            {index >= 0 && (
              <span className="ml-1.5 text-[13px] text-neutral-500 tabular-nums">
                第 {index + 1} / {visible.length} 位
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {student && (
              <Link
                href={studentDetailHref(student.id, selHref(student.id))}
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
              onClick={clear}
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
    </>
  );
};

export default StudentsTableView;
