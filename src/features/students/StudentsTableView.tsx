"use client";

import { useCallback } from "react";
import Link from "next/link";
import { SquareArrowOutUpRight, X } from "lucide-react";
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

/**
 * 桌面版學生頁：全寬名單，點一列從右邊滑出學生詳情。
 *
 * 選取鏡射到網址（`?sel=`）的行為沿用 `useSelectionMirroredToUrl`——為什麼
 * state 是真相、網址只是鏡射，理由寫在那裡。關掉抽屜就清掉選取和網址參數。
 *
 * 抽屜裡是跟獨立學生頁同一套頁首＋分頁；600px 寬時 `StudentDetail` 會自己把
 * 側欄收成「資料」分頁。抽屜沒有自己的標題列：「開啟完整頁」（可分享的網址）
 * 與關閉做成灰色小圖示，接在頁首動作按鈕後面，把高度留給分頁。
 */
const StudentsTableView = () => {
  const { selectedId, select, clear } = useSelectionMirroredToUrl("sel");

  // `currentData`, not `data`: `data` keeps the PREVIOUS student while the next
  // one loads, so the sheet showed the wrong person and a click looked ignored.
  const { currentData: student, isLoading } = useGetStudentQuery(
    { id: selectedId as number },
    { skip: selectedId == null }
  );

  const handleSelect = useCallback((next: Student) => select(next.id), [select]);

  return (
    <>
      <StudentList variant="table" selectedId={selectedId} onSelect={handleSelect} />
      <SideSheet
        open={selectedId != null}
        onClose={clear}
        label={student ? student.name : "學生詳情"}
        className="w-[600px]"
      >
        <div className="relative flex-1 min-h-0 flex flex-col">
          {isLoading || !student ? (
            <>
              {/* 載入中還沒有頁首，關閉鈕先浮在右上角 */}
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                onClick={clear}
                aria-label="關閉"
                className="absolute top-4 right-4 text-neutral-500"
              >
                <X className="w-5 h-5" />
              </Button>
              <StudentDetailSkeleton variant="pane" />
            </>
          ) : (
            <>
              <StudentDetailHeader
                student={student}
                variant="pane"
                trailing={
                  <>
                    <Link
                      href={studentDetailHref(student.id, selHref(student.id))}
                      aria-label="開啟完整頁"
                      title="開啟完整頁"
                      className={`${buttonVariants({ variant: "ghost", size: "iconSm" })} text-neutral-500`}
                    >
                      <SquareArrowOutUpRight className="w-4 h-4" />
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="iconSm"
                      onClick={clear}
                      aria-label="關閉"
                      className="text-neutral-500"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </>
                }
              />
              <AttentionBar student={student} hideRenewal className="flex-none px-6 pt-3 bg-white" />
              <StudentDetail student={student} variant="pane" />
            </>
          )}
        </div>

        <div className="flex-none flex gap-4 px-4 py-2 border-t border-neutral-200 bg-neutral-50 text-[11px] text-neutral-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-px border border-neutral-200 rounded-sm bg-white">↑</kbd>
            <kbd className="px-1 py-px border border-neutral-200 rounded-sm bg-white">↓</kbd>
            換學生
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-px border border-neutral-200 rounded-sm bg-white">Esc</kbd>
            關閉
          </span>
        </div>
      </SideSheet>
    </>
  );
};

export default StudentsTableView;
