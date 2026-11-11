"use client";

import { useCallback, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import StudentList from "./StudentList";
import { Student } from "@/store/slices/students";
import StudentSheet from "./StudentSheet";
import { Button } from "@/components/ui/button";
import { useSelectionMirroredToUrl } from "@/components/SplitView";

const selHref = (studentId: number) => `/students?sel=${studentId}`;

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
      <StudentSheet
        studentId={selectedId}
        onClose={clear}
        from={selectedId != null ? selHref(selectedId) : undefined}
        leading={
          <>
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
          </>
        }
      />
    </>
  );
};

export default StudentsTableView;
