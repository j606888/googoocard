"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import StudentList from "./StudentList";
import StudentDetail from "./StudentDetail";
import StudentDetailHeader from "./StudentDetail/StudentDetailHeader";
import { Student, useGetStudentQuery } from "@/store/slices/students";
import { studentDetailHref } from "@/lib/studentNav";
import ListSkeleton from "@/components/skeletons/ListSkeleton";

const parseSel = (value: string | null): number | null =>
  value && /^\d+$/.test(value) ? Number(value) : null;

const selHref = (studentId: number) => `/students?sel=${studentId}`;

/**
 * 桌面版學生頁：左邊名單常駐、右邊換人不換頁。
 *
 * 選取狀態同時活在兩個地方，各有理由：
 *   - React state 是**畫面的真相**。`router.replace` 只改 query 時不會讓這頁的
 *     `useSearchParams()` 重繪，靠網址驅動畫面會整個選不動（實測過）；而且換人
 *     也不該等一次 soft navigation。
 *   - 網址是**可分享的鏡射**。用 `history.replaceState` 寫回（和 StudentDetail
 *     寫 `?tab=` 同一招），所以連續看十位學生不會在瀏覽紀錄堆十筆，重新整理
 *     或把連結貼給別人也還是同一位學生。
 *
 * 右欄只放日常會看的三個分頁；轉換卡片、停用、備註這類深度操作維持在原本的
 * 三欄完整頁面（右上角「完整頁面」）。
 */
const StudentsSplitView = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramId = parseSel(searchParams.get("sel"));
  const [selectedId, setSelectedId] = useState<number | null>(paramId);

  // 從外部帶進來的網址（分享連結、從完整頁面返回）要蓋掉目前選取
  useEffect(() => {
    if (paramId == null) return;
    setSelectedId((prev) => (prev === paramId ? prev : paramId));
  }, [paramId]);

  // 選取變動 → 鏡射到網址
  useEffect(() => {
    if (selectedId == null) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("sel") === String(selectedId)) return;
    url.searchParams.set("sel", String(selectedId));
    window.history.replaceState(null, "", url);
  }, [selectedId]);

  const { data: student, isLoading } = useGetStudentQuery(
    { id: selectedId as number },
    { skip: selectedId == null }
  );

  const select = useCallback((next: Student) => setSelectedId(next.id), []);

  const openFull = useCallback(
    (next: Student) => router.push(studentDetailHref(next.id, selHref(next.id))),
    [router]
  );

  return (
    <div className="flex h-[calc(100vh-60px)] min-h-0">
      <aside className="w-[380px] shrink-0 border-r border-neutral-200 min-h-0">
        <StudentList
          variant="roster"
          selectedId={selectedId}
          onSelect={select}
          onOpenFull={openFull}
        />
      </aside>

      <section className="flex-1 min-w-0 flex flex-col min-h-0">
        {selectedId == null ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full">
              <Users className="w-6 h-6 text-primary-700" />
            </div>
            <p className="text-neutral-500 text-sm">從左邊選一位學生</p>
          </div>
        ) : isLoading || !student ? (
          <ListSkeleton />
        ) : (
          <>
            <StudentDetailHeader
              student={student}
              variant="pane"
              fullHref={studentDetailHref(student.id, selHref(student.id))}
            />
            <StudentDetail student={student} layout="tabs" />
          </>
        )}
      </section>
    </div>
  );
};

export default StudentsSplitView;
